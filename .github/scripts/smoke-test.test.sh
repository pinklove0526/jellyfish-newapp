#!/usr/bin/env bash
# Self-test for smoke-test.sh against a scripted local stub server. Each scenario
# lists the responses the stub gives, in order (the last one repeats), as
# "<status>:<git sha or - for no build info>".
set -u
here="$(cd "$(dirname "$0")" && pwd)"
sha="0123456789abcdef0123456789abcdef01234567"
old="fedcba9876543210fedcba9876543210fedcba98"
work="$(mktemp -d)"
server_pid=
stop_server() { [ -n "$server_pid" ] && kill "$server_pid" 2>/dev/null; server_pid=; }
trap 'stop_server; rm -rf "$work"' EXIT

cat > "$work/stub.py" <<'PY'
import http.server, sys, json
steps = [s.split(":", 1) for s in sys.argv[2].split(",")]
state = {"i": 0}
class H(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path != sys.argv[3]:  # readiness probes must not use up scripted answers
            self.send_response(404); self.send_header("Content-Length", "0"); self.end_headers(); return
        status, sha = steps[min(state["i"], len(steps) - 1)]
        state["i"] += 1
        body = json.dumps({"tiles": [], **({"build": {"gitSha": sha}} if sha != "-" else {})}).encode()
        self.send_response(int(status)); self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def log_message(self, *a): pass
http.server.HTTPServer(("127.0.0.1", int(sys.argv[1])), H).serve_forever()
PY

failures=0
run() { # name expected_exit expected_text steps [env...]
  local name="$1" want="$2" text="$3" steps="$4"; shift 4
  local port=$((20000 + RANDOM % 20000))
  if [ "$steps" != "NOSERVER" ]; then
    python3 "$work/stub.py" "$port" "$steps" "${STUB_PATH:-/api/manifest}" & server_pid=$!
    for _ in $(seq 1 50); do curl -s -o /dev/null "http://127.0.0.1:$port/" && break; sleep 0.1; done
  fi
  out="$(env BASE_URL="http://127.0.0.1:$port" EXPECTED_SHA="$sha" SMOKE_DEADLINE_SECONDS=4 \
        SMOKE_INITIAL_BACKOFF_SECONDS=1 SMOKE_MAX_BACKOFF_SECONDS=1 SMOKE_REQUEST_TIMEOUT_SECONDS=2 \
        "$@" "$here/smoke-test.sh" 2>&1)"; got=$?
  stop_server; wait 2>/dev/null
  if [ "$got" = "$want" ] && grep -qF -- "$text" <<<"$out"; then echo "PASS $name (exit $got)"
  else echo "FAIL $name: exit $got (want $want), wanted text '$text'"; echo "$out" | sed 's/^/    /'; failures=$((failures + 1)); fi
}

run "answers immediately with the expected SHA"            0 "OK:"                       "200:$sha"
run "cold start (503s) then the stale container, then new" 0 "after 4 attempt(s)"        "503:-,503:-,200:$old,200:$sha"
run "stale SHA that never changes fails"                   1 "expected '$sha'"           "200:$old"
run "persistent 503 fails"                                 1 "HTTP 503"                  "503:-"
run "200 without build info fails"                         1 "build.gitSha is '<missing>'" "200:-"
run "nothing listening fails"                              1 "no HTTP response"          "NOSERVER"
STUB_PATH=/manifest.json run "Pages: custom manifest path (SMOKE_MANIFEST_PATH)"  0 "/manifest.json answered 200" "404:-,200:$sha" SMOKE_MANIFEST_PATH=/manifest.json
STUB_PATH=/manifest.json run "Pages: default path is not served there, so it fails" 1 "HTTP 404" "200:$sha"
run "non-https URL is refused"                             2 "must be an https:// URL"   "200:$sha" BASE_URL=http://example.com

[ "$failures" = 0 ] && echo "all smoke-test self-tests passed" || { echo "$failures self-test(s) failed"; exit 1; }
