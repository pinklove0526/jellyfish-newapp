# End-to-end checks

Playwright (`@playwright/test`, Chromium only) tests that drive the running
Spring Boot app in a real browser. This folder has its own `package.json`; the
one in the repository root belongs to the Cloudflare Worker.

What is covered: every tile renders and opens its detail panel, tile actions,
the Tasks -> Calendar event-bus demo, the Runtime graph and Deployed apps tiles,
a 390 px mobile layout, and the failure paths. The failure paths (a module that
hangs, 404s, has no `mount()`, a `detail()` or action that throws, a failed
`/api/manifest`) are injected from the tests with `page.route()`; the app is
never modified.

## Run locally

```bash
mvn -B clean verify -Dgit.sha=$(git rev-parse HEAD)
java -jar target/jellyfish-newapp-*.jar --server.port=8080 &

cd e2e
npm ci
npx playwright install chromium     # once
npx playwright test
npx playwright show-report          # after a failure
```

Set `BASE_URL` if the app is not on `http://localhost:8080`. Set
`E2E_EXPECTED_SHA` to also assert the commit baked into the build.

## Two modes: live and static

The same specs run against two builds of the app, chosen with `E2E_MODE`:

| `E2E_MODE` | Runs against | Base URL |
|---|---|---|
| `live` (default) | the Spring Boot app | `http://localhost:8080/` |
| `static` | the GitHub Pages snapshot in `../site`, served by `static-server.js` under `/jellyfish-newapp/` | `http://localhost:8081/jellyfish-newapp/` |

Everything that differs (the manifest URL, module paths, the sub-path) lives in
`tests/mode.js`; specs never branch on the mode. Specs navigate with relative
URLs (`./`) so they work under the sub-path. `tests/static-site.spec.js` holds
the checks that only apply to the snapshot (trailing slash, nothing requested
outside the sub-path, the snapshot marker, `.nojekyll`, the 404 page); in a live
run they are reported as skipped ("static-only").

```bash
.github/scripts/build-pages.sh target/jellyfish-newapp-*.jar   # writes ../site
cd e2e && E2E_MODE=static npx playwright test                  # starts static-server.js itself
```

`static-server.js` mimics only what GitHub Pages does for a project site: the
site lives under a sub-path, everything outside it is a 404, the sub-path
without its slash redirects, and a missing file gets `404.html`.

CI (`e2e` job in `.github/workflows/ci.yml`) runs the same tests against the jar
built by the `build` job and uploads the HTML report, traces and screenshots when
a check fails. The `pages-e2e` job runs `E2E_MODE=static` against the Pages artifact.
