# jellyfish-newapp

[![CI](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml?query=branch%3Adevelop)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

A Windows 8 "Metro"-style Start screen served by Spring Boot, and a small
**micro-frontend (MFE) concept lab**: a place to try out the moving parts of a
micro-frontend architecture with no framework and no bundler, just Spring MVC,
vanilla JavaScript and [w3.css](https://www.w3schools.com/w3css/).

> **Status:** every micro-frontend feature in the table below is built. The
> manifest endpoint, its validation and the home page have MockMvc and unit tests
> (`mvn verify`), and the browser side (every tile, the failure paths, the
> diagnostics tiles, the mobile layout) has Playwright end-to-end tests in
> [`e2e/`](e2e/README.md).

## Micro-frontend concept mapping

| Concept | In this project | Status |
|---|---|---|
| **Shell** | `static/js/main.js`: fetches the manifest, renders a frame per enabled tile, loads each tile, and owns the detail panel and status bar | built |
| **Manifest** | `GET /api/manifest` lists each tile's id, title, version, module URL and enabled flag (plus group, size and colour), read from `mfe.tiles` in `application.yml` and validated at startup | built |
| **Independently loaded remotes** | Each tile is an ES module under `static/tiles/<id>/v1/`, loaded with dynamic `import()` and exposing `mount(el, ctx)` / `unmount()` (and an optional `detail()`) | built |
| **Versioned paths** | Tiles are served from `/tiles/<id>/v1/...`; each tile shows its version, and the detail panel shows its module path | built |
| **Cross-tile messaging** | A tiny `CustomEvent` bus (`static/js/bus.js`, handed to tiles as `ctx.bus`); the Tasks tile publishes `tasks:changed` and the Calendar tile shows it | built |
| **Fault isolation** | Each tile loads, renders its detail panel and runs its actions inside its own `try/catch`, and loading times out after 5 s. A tile that throws, hangs or 404s becomes an "unavailable" frame (the Broken demo tile always does) and the rest keep running | built |
| **Runtime graph** | The Runtime graph tile draws shell → manifest → tiles with live/failed status, from the `shell:runtime` snapshot the shell publishes on the bus | built |
| **Deployed apps** | The Deployed apps tile lists each tile's version, status and module path, plus the app version, git SHA and build time that `/api/manifest` reports | built |

## Writing a tile

A tile is `static/tiles/<id>/v<major>/index.js` plus an entry in `mfe.tiles` in
`application.yml`. The module exports:

```js
export function mount(el, ctx) {}   // render into el, start timers
export function unmount() {}        // stop timers, unsubscribe from the bus
export function detail() {}         // optional: { body, actions: [{ label, onClick }] }
```

`ctx` is `{ id, title, version, setStatus(message), flip(el, text), bus }`.
`detail()` may also return a DOM `node` to show in the panel.
`ctx.bus.emit(type, detail)` and `ctx.bus.on(type, handler, { replay })` carry
cross-tile messages; name events `<tile-id>:<what-happened>`. `replay: true`
delivers the last event to a tile that starts after the publisher.

## Run locally

Requires JDK 17 and Maven.

```bash
mvn spring-boot:run
```

Then open <http://localhost:8080>. Run the build and tests with `mvn verify`.

## Branch flow

feature branch -> PR to `develop` -> PR from `develop` to `staging`

| Branch | What it is for |
|---|---|
| feature branches | One change each, branched off `develop` and merged only through a PR to `develop`. |
| `develop` | Where changes are integrated and tested. CI runs on every push and pull request. **Nothing deploys from `develop`.** |
| `staging` | The production branch: whatever is on `staging` is what is deployed, and it is the source of truth for the live deployment. It only receives changes through a PR from `develop`, and **a merge to `staging` deploys**. |

> **Naming quirk:** the branch and the GitHub Environment are both called
> `staging`, but this is not a pre-production stage and there is no separate
> production. The deployment that `staging` produces *is* production. Other
> names that carry the word (the `deploy-staging` concurrency group,
> `wrangler.staging.jsonc`, the `STAGING_URL` variable) refer to that same
> deployment.

To release a change:

1. Open a PR from a feature branch to `develop`. CI runs (the `deploy` job is
   skipped on pull requests). Merge when it is green.
2. Open a PR from `develop` to `staging`. CI runs again on that PR. Merge when it
   is green.
3. The merge is a push to `staging`. The pipeline runs on the resulting commit
   and, only if every check passes, the `deploy` job deploys that commit and
   smoke-tests it (see [Production deployment](#production-deployment)). The
   deployed SHA is the SHA of the commit on `staging`.

`staging` is meant to be protected so that it can only change through such a PR;
see the [settings checklist](#repository-settings-checklist-owner). Nothing is
pushed to it directly.

## Build and deploy

- **Container:** the `Dockerfile` builds the jar with Microsoft Build of
  OpenJDK 17 and Maven, and runs it on the OpenJDK 17 distroless image as a
  non-root user, listening on port 8080.
- **Cloudflare (production):** `worker/index.ts` and `wrangler.jsonc` define a
  Worker that starts the container on Cloudflare Containers (`standard-1`
  instance, no outbound internet) and proxies every request to it. CI deploys it
  to production on every push to the `staging` branch; see
  [Production deployment](#production-deployment) and [Branch flow](#branch-flow).
  Nothing deploys from `develop`.
- **Build info:** `/api/manifest` includes the app version, build time and the
  git SHA the build was made from. Pass the SHA with `-Dgit.sha=<sha>` for Maven
  or `--build-arg GIT_SHA=<sha>` for `docker build`; CI does both, and the production
  deploy passes it through Wrangler's `build_vars`. Without one it shows
  `unknown`, which is what a manual `npm run deploy` gives.
- **CI** (`.github/workflows/ci.yml`) has six jobs:
  - `build`: `mvn verify` inside the OpenJDK 17 image.
  - `container-image`: builds the image and smoke-tests it at `standard-1`
    limits.
  - `sbom`: [BomLens](https://github.com/sktelecom/bomlens) generates an SBOM,
    notice, and security and license reports (uploaded as the `sbom`
    artifact). Vulnerabilities are report-only; a known malicious package
    fails the job.
  - `worker`: type-checks the Worker, runs a dry-run deploy and self-tests the
    post-deploy smoke test script.
  - `e2e`: runs the Playwright tests in [`e2e/`](e2e/README.md) (Chromium only)
    against the jar built by `build`. On failure the HTML report, traces and
    screenshots are uploaded as the `e2e-report` artifact.
  - `deploy`: runs only on a push to `staging`, after all five jobs above passed
    on that same commit. See below.

## Production deployment

A push to `staging` (a merged PR from `develop`, see [Branch flow](#branch-flow))
runs the whole pipeline, and only if every job passes does the `deploy` job run.
It never runs on pull requests.

What the `deploy` job does:

1. Uses the GitHub Environment **`staging`** and a concurrency group, so deploys
   never overlap and a running deploy is never cancelled (a newer push that is
   still waiting replaces an older waiting one).
2. Copies `wrangler.jsonc` with the commit SHA added as the image build variable
   `GIT_SHA` (`wrangler.jsonc` must therefore stay plain JSON, without comments).
3. Runs `wrangler deploy`. Wrangler builds the `Dockerfile` with Docker on the
   runner and pushes the image to Cloudflare's registry as part of the deploy.
4. Smoke-tests the deployment: fetches `/api/manifest`, requires HTTP 200 and
   `build.gitSha` equal to the commit being deployed, retrying with backoff (up
   to 10 minutes) for the container cold start. A deployment that is still on a
   different SHA at the deadline fails the job.

A deploy does not restart a container that is already running: it keeps the
image it started from. The Worker therefore compares the running container's
image with the one it was deployed with and replaces the container when they
differ, which happens on the first request after a deploy.

The Worker is named `jellyfish-newapp` in `wrangler.jsonc`. There is no `env`
block, so there is a single deployment under that name.

### One-time setup (you do this; no secret values belong in the repository)

1. In **Settings -> Environments**, create an environment named `staging`, then
   apply the [settings checklist](#repository-settings-checklist-owner) below.
2. Create these two **secrets** (on the `staging` environment, which is
   preferred, or on the repository):
   - `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID.
   - `CLOUDFLARE_API_TOKEN`: an **Account API token** scoped to that one account
     only. Start from the **Edit Cloudflare Workers** template (the one
     Cloudflare's GitHub Actions guide uses) and **add** the account permissions
     **Containers Edit** and **Cloudchamber Edit**.
3. Optional: a **variable** (not a secret) `STAGING_URL` with the deployment's
   `https://` URL. Without it the job uses the URL Wrangler prints.

About the token: Cloudflare's CI guide names only the template above. Its
Containers documentation does not say what a deploy needs, and the two additions
are an inference from Wrangler itself, which requests the `containers:write` and
`cloudchamber:write` scopes when you log in. If the first deploy fails with a
permission error, the error says which permission is missing; once it works you
can try removing ones you do not need. The first deploy can take several
minutes while Cloudflare provisions the image.

### Repository settings checklist (owner)

Repository settings are changed by the repository owner; nothing in this
repository changes them.

**Branch `staging`** (Settings -> Branches, a branch protection rule or a
ruleset for `staging`):

- [ ] Require a pull request before merging.
- [ ] Require status checks to pass before merging, and add exactly these five:
  `build`, `container-image`, `sbom`, `worker`, `e2e`. Do **not** add `deploy`:
  it only runs on a push to `staging` and is skipped on pull requests, so it
  must not gate them.
- [ ] Block force pushes.
- [ ] Block deletion of the branch.

A check can be picked in that list only after it has run recently, so open the
PR from `develop` to `staging` first. By default administrators can bypass these
rules; there is a setting to enforce them for administrators too if you want
that.

**Environment `staging`** (Settings -> Environments -> `staging`):

- [ ] Deployment branches and tags: choose "Selected branches and tags" and allow
  only the `staging` branch.
- [ ] Optional: add required reviewers, so that each deploy waits for approval
  before it runs.

## Inspiration

The architecture (shell, manifest, independently loaded remotes, fault
isolation, runtime graph) is inspired by the micro-frontend demo at
<https://tg-labs-mfe.gioitv-dev.workers.dev/>. This project is an independent
implementation: no code, copy or content from that site is used.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

Third-party components, including some whose licensing is unclear, are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
