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

CI (`e2e` job in `.github/workflows/ci.yml`) runs the same tests against the jar
built by the `build` job and uploads the HTML report, traces and screenshots when
a check fails.
