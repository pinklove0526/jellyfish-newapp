#!/usr/bin/env bash
# Post-deploy smoke test. Polls $BASE_URL/api/manifest (or $SMOKE_MANIFEST_PATH) until it answers HTTP 200
# with build.gitSha equal to $EXPECTED_SHA, and fails if that has not happened
# before the deadline. Retrying with backoff covers the container's cold start
# and the moment after a deploy when the previous container is still being
# replaced; a SHA that is still different at the deadline is a failed deploy.
#
# Required: BASE_URL (https), EXPECTED_SHA
# Optional: SMOKE_MANIFEST_PATH (/api/manifest; the Pages site uses /manifest.json),
#           SMOKE_DEADLINE_SECONDS (600), SMOKE_INITIAL_BACKOFF_SECONDS (5),
#           SMOKE_MAX_BACKOFF_SECONDS (30), SMOKE_REQUEST_TIMEOUT_SECONDS (180)
set -u

: "${BASE_URL:?BASE_URL is required}"
: "${EXPECTED_SHA:?EXPECTED_SHA is required}"
deadline="${SMOKE_DEADLINE_SECONDS:-600}"
initial_backoff="${SMOKE_INITIAL_BACKOFF_SECONDS:-5}"
max_backoff="${SMOKE_MAX_BACKOFF_SECONDS:-30}"
request_timeout="${SMOKE_REQUEST_TIMEOUT_SECONDS:-180}"

base="${BASE_URL%/}"
case "$base" in
  https://*) ;;
  http://localhost*|http://127.0.0.1*) ;; # local self-test only
  *) echo "::error::BASE_URL must be an https:// URL, got: $base"; exit 2 ;;
esac

manifest_path="/${SMOKE_MANIFEST_PATH:-/api/manifest}"
manifest_path="/${manifest_path#/}"
url="$base$manifest_path"
body="$(mktemp)"
trap 'rm -f "$body"' EXIT

start="$(date +%s)"
attempt=0
delay="$initial_backoff"
reason=""
while :; do
  attempt=$((attempt + 1))
  code="$(curl -sS -H 'Cache-Control: no-cache' -o "$body" -w '%{http_code}' --max-time "$request_timeout" "$url" 2>/dev/null)" || code=000

  if [ "$code" = "200" ]; then
    sha="$(jq -r '.build.gitSha // empty' "$body" 2>/dev/null || true)"
    if [ "$sha" = "$EXPECTED_SHA" ]; then
      echo "OK: $url answered 200 with build.gitSha $sha after $attempt attempt(s), $(( $(date +%s) - start ))s"
      exit 0
    fi
    reason="HTTP 200 but build.gitSha is '${sha:-<missing>}', expected '$EXPECTED_SHA'"
  elif [ "$code" = "000" ]; then
    reason="no HTTP response (connection failed or timed out)"
  else
    reason="HTTP $code"
  fi

  elapsed=$(( $(date +%s) - start ))
  echo "attempt $attempt (${elapsed}s): $reason"
  if [ "$elapsed" -ge "$deadline" ]; then
    echo "::error::Smoke test failed after ${elapsed}s and $attempt attempts: $reason"
    exit 1
  fi
  sleep "$delay"
  delay=$(( delay * 2 > max_backoff ? max_backoff : delay * 2 ))
done
