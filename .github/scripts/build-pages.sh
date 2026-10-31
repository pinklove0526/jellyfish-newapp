#!/usr/bin/env bash
# Builds the GitHub Pages site: a static snapshot of the app, taken from the
# built jar. It starts the jar, saves what it serves, stops it, and writes the
# result to $SITE_DIR (default: site/). Pages serves the snapshot, so the
# published site has no running Spring backend.
#
# Usage: build-pages.sh [path/to/jellyfish-newapp.jar]
#
# Optional environment:
#   SITE_DIR         output directory, emptied first (site)
#   PAGES_BASE_PATH  sub-path of the project site, used by 404.html (/jellyfish-newapp)
#   EXPECTED_SHA     if set, the manifest's build.gitSha must equal it
#   JAVA_BIN         java executable (java)
#   SNAPSHOT_PORT    port the jar listens on while it is snapshotted (18080)
#
# The snapshot differs from what Spring serves in exactly three ways, all done
# here and nowhere in the app:
#   1. /api/manifest is saved as manifest.json, and the page's data-manifest-url
#      points at it;
#   2. the leading "/" is removed from the page's four root-absolute URLs and
#      from every tile's moduleUrl, so the site works under a sub-path
#      (main.js resolves moduleUrl against the page);
#   3. the footer says this is a static snapshot.
set -euo pipefail

site="${SITE_DIR:-site}"
base_path="${PAGES_BASE_PATH:-/jellyfish-newapp}"
base_path="/${base_path#/}"; base_path="${base_path%/}"
port="${SNAPSHOT_PORT:-18080}"
java_bin="${JAVA_BIN:-java}"
jar="${1:-$(ls target/jellyfish-newapp-*.jar 2>/dev/null | head -1 || true)}"

fail() { echo "::error::build-pages: $*" >&2; exit 1; }

[ -f "$jar" ] || fail "jar not found: '${jar:-<none>}' (build it first with mvn verify)"
case "$site" in ''|/|.|..) fail "refusing to use SITE_DIR='$site'" ;; esac
for tool in curl jq unzip sed; do command -v "$tool" >/dev/null || fail "$tool is required"; done

work="$(mktemp -d)"
pid=
stop_app() { if [ -n "$pid" ]; then kill "$pid" 2>/dev/null || true; wait "$pid" 2>/dev/null || true; pid=; fi; }
trap 'stop_app; rm -rf "$work"' EXIT

# 1. Start the app and wait for the manifest.
"$java_bin" -jar "$jar" --server.port="$port" > "$work/app.log" 2>&1 &
pid=$!
start="$(date +%s)"
until curl -fsS -o "$work/manifest.raw" "http://127.0.0.1:$port/api/manifest" 2>/dev/null; do
  kill -0 "$pid" 2>/dev/null || { cat "$work/app.log"; fail "the app exited before answering"; }
  if [ $(( $(date +%s) - start )) -ge 60 ]; then cat "$work/app.log"; fail "/api/manifest did not answer within 60s"; fi
  sleep 1
done

# 2. Save what the app serves, then stop it.
curl -fsS -o "$work/index.raw" "http://127.0.0.1:$port/"
unzip -q "$jar" 'BOOT-INF/classes/static/*' -d "$work/jar"
stop_app

# 3. Assemble the site.
rm -rf "$site"
mkdir -p "$site"
cp -R "$work/jar/BOOT-INF/classes/static/." "$site/"

short_sha="$(jq -r '.build.gitSha' "$work/manifest.raw")"
built_at="$(jq -r '.build.builtAt // empty' "$work/manifest.raw")"
[[ "$short_sha" =~ ^[0-9a-f]{7,40}$ ]] || fail "the jar has no usable build.gitSha ('$short_sha'); build it with -Dgit.sha=<commit>"
[ -n "$built_at" ] || fail "the jar has no build.builtAt"
if [ -n "${EXPECTED_SHA:-}" ] && [ "$short_sha" != "$EXPECTED_SHA" ]; then
  fail "build.gitSha is $short_sha, expected $EXPECTED_SHA"
fi
short_sha="${short_sha:0:7}"

# manifest.json: the real manifest, with site-relative module URLs.
jq '.tiles |= map(.moduleUrl |= ltrimstr("/"))' "$work/manifest.raw" > "$site/manifest.json"

# index.html: relative URLs, the manifest.json pointer and the snapshot marker.
sed -E \
  -e 's#(href|src)="/(css|js)/#\1="\2/#g' \
  -e 's#data-manifest-url="/api/manifest"#data-manifest-url="manifest.json"#' \
  -e 's#<span id="status-time"></span>#&\n    <span id="snapshot-note" title="This page is a static snapshot of the app, served by GitHub Pages. No Spring backend is running."><b>Static snapshot</b><span class="more"> · built from '"$short_sha"' · not a live Spring instance</span></span>#' \
  -e 's|</head>|<style>\n        #snapshot-note { flex: 1; text-align: center; padding: 0 12px; opacity: 0.85; min-width: 0; }\n        @media (max-width: 700px) { #snapshot-note .more { display: none; } }\n    </style>\n</head>|' \
  "$work/index.raw" > "$site/index.html"

# 404.html: GitHub Pages serves it for any missing path, at any depth, so it
# uses <base> and the site's own stylesheets.
cat > "$site/404.html" <<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <base href="$base_path/">
    <title>Not found - Jellyfish Start</title>
    <link rel="stylesheet" href="css/w3.css">
    <link rel="stylesheet" href="css/w3-colors-win8.css">
    <style>
        html, body { margin: 0; min-height: 100%; background: #1d1d1d; color: #fff;
            font-family: "Segoe UI", "Segoe UI Web", "Helvetica Neue", Arial, sans-serif; }
        main { padding: 64px 48px; max-width: 640px; }
        h1 { margin: 0 0 8px; font-weight: 200; font-size: 48px; }
        p { font-weight: 300; font-size: 18px; }
        a.back { display: inline-block; padding: 12px 24px; color: #fff; text-decoration: none; }
        @media (max-width: 700px) { main { padding: 32px 16px; } }
    </style>
</head>
<body>
<main>
    <h1>Not found</h1>
    <p>There is nothing at this address. This site is a static snapshot of the Jellyfish dashboard.</p>
    <a class="back w3-win8-cyan" href="./">Back to Start</a>
</main>
</body>
</html>
HTML

: > "$site/.nojekyll"

# 4. Checks: fail the build here rather than ship a site that is broken under a sub-path.
# (404.html's <base href> is the one intentional absolute URL.)
if grep -nE '(href|src|action)="/[^/]' "$site/index.html" "$site/404.html" | grep -v '<base href='; then
  fail "root-absolute URLs remain in the page (listed above)"
fi
grep -q 'data-manifest-url="manifest.json"' "$site/index.html" || fail "index.html does not point at manifest.json"
grep -q 'id="snapshot-note"' "$site/index.html" || fail "the snapshot marker was not added to index.html"
jq -e '(.tiles | length) > 0 and all(.tiles[]; (.moduleUrl | startswith("/") | not))' "$site/manifest.json" >/dev/null \
  || fail "manifest.json has no tiles, or a moduleUrl is still absolute"
for file in $(jq -r '.tiles[].moduleUrl' "$site/manifest.json") css/w3.css css/w3-colors-win8.css js/main.js js/bus.js; do
  [ -f "$site/$file" ] || fail "missing from the site: $file"
done

echo "Pages site written to $site/: $(find "$site" -type f | wc -l) files, $(jq '.tiles | length' "$site/manifest.json") tiles, build.gitSha $short_sha, built $built_at"
