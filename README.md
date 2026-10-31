# jellyfish-newapp

[![CI](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml?query=branch%3Adevelop)
[![Pages deploy](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml/badge.svg?branch=staging&event=push)](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml?query=branch%3Astaging)
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

> **Live site:** <https://pinklove0526.github.io/jellyfish-newapp/>, a static
> snapshot on GitHub Pages with no running Spring backend. **Available after the
> first successful deploy**; it has not run yet. See
> [Production deployment](#production-deployment).

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
This is the full Spring app; the live site is only a static snapshot of it.

## Branch flow

feature branch -> PR to `develop` -> PR from `develop` to `staging`

| Branch | What it is for |
|---|---|
| feature branches | One change each, branched off `develop` and merged only through a PR to `develop`. |
| `develop` | Where changes are integrated and tested. CI runs on every push and pull request. **Nothing deploys from `develop`.** |
| `staging` | The production branch: whatever is on `staging` is what is published, and it is the source of truth for the live site. It only receives changes through a PR from `develop`, and **a merge to `staging` publishes the GitHub Pages snapshot** (see [Production deployment](#production-deployment)). It also triggers the optional Cloudflare deployment, which is dormant. |

> **Naming quirk:** the branch is called `staging`, but this is not a
> pre-production stage and there is no separate production. The site that
> `staging` produces *is* production. The Pages deployment uses the GitHub
> Environment `github-pages`. The other names that carry the word (the GitHub
> Environment `staging`, the `deploy-staging` concurrency group,
> `wrangler.staging.jsonc`, the `STAGING_URL` variable) belong to the dormant
> Cloudflare deployment.

To release a change:

1. Open a PR from a feature branch to `develop`. CI runs (`pages-deploy` and
   `deploy` are skipped on pull requests). Merge when it is green.
2. Open a PR from `develop` to `staging`. CI runs again on that PR. Merge when it
   is green.
3. The merge is a push to `staging`. The pipeline runs on the resulting commit
   and, when every required job passes, `pages-deploy` publishes that commit's
   snapshot to GitHub Pages and smoke-tests it (see
   [Production deployment](#production-deployment)). The published SHA is the SHA
   of the commit on `staging`. The Cloudflare `deploy` job also looks at this
   push, but it is skipped unless `DEPLOY_ENABLED` is `true`.

`staging` is meant to be protected so that it can only change through such a PR;
see the [settings checklist](#repository-settings-checklist-owner). Nothing is
pushed to it directly.

## Build and deploy

- **Container:** the `Dockerfile` builds the jar with Microsoft Build of
  OpenJDK 17 and Maven, and runs it on the OpenJDK 17 distroless image as a
  non-root user, listening on port 8080. CI builds and smoke-tests it; it is not
  published anywhere today.
- **GitHub Pages (production):** CI turns the built jar into a static snapshot
  (`.github/scripts/build-pages.sh`) and publishes it from the `staging` branch.
  See [Production deployment](#production-deployment).
- **Cloudflare Containers (optional, dormant):** `worker/index.ts` and
  `wrangler.jsonc` define a Worker that starts the container on Cloudflare
  Containers (`standard-1` instance, no outbound internet) and proxies every
  request to it. CI only deploys it when the repository variable
  `DEPLOY_ENABLED` is `true`, which it is not; see
  [Cloudflare Containers](#cloudflare-containers-optional-dormant).
- **Build info:** `/api/manifest` includes the app version, build time and the
  git SHA the build was made from. Pass the SHA with `-Dgit.sha=<sha>` for Maven
  or `--build-arg GIT_SHA=<sha>` for `docker build`; CI does both, and the
  dormant Cloudflare deploy passes it through Wrangler's `build_vars`. Without
  one it shows `unknown`, which is what a manual `npm run deploy` gives. The
  Pages snapshot saves this manifest as `manifest.json`, and its build fails if
  the SHA is missing.
- **CI** (`.github/workflows/ci.yml`) has nine jobs:
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
  - `pages-build`: builds the static site from the jar and uploads it as the
    Pages artifact. It also runs on pull requests (build only), so breakage
    shows up before the merge.
  - `pages-e2e`: runs the same Playwright specs (`E2E_MODE=static`) against that
    artifact, served by a plain file server under `/jellyfish-newapp/`.
  - `pages-deploy`: runs only on a push to `staging`, after the seven jobs above
    passed on that same commit. It publishes the Pages artifact, then
    smoke-tests the published `manifest.json`.
  - `deploy`: the Cloudflare deployment. It runs only on a push to `staging`,
    after the first five jobs passed, and only when `DEPLOY_ENABLED` is `true`.
    Unset, it is skipped. It does not gate `pages-deploy` and vice versa.

## Production deployment

Production is the **GitHub Pages static snapshot** of the `staging` branch.
Cloudflare Containers remain an optional path that is dormant (see
[below](#cloudflare-containers-optional-dormant)).

> **Live site:** <https://pinklove0526.github.io/jellyfish-newapp/>
> **Available after the first successful deploy.** `pages-deploy` has not run
> yet, so this link is expected to fail until it has, and until the
> [one-time settings](#repository-settings-checklist-owner) are applied.

**GitHub Pages serves a snapshot, so the live site has no running Spring
backend.** The full Spring Boot app runs locally (`mvn spring-boot:run`) and
under test (`mvn verify` and the `e2e` job). The live site is what that app
served at build time, saved as files. See
[What the static snapshot cannot show](#what-the-static-snapshot-cannot-show).

The badge at the top of this file ("Pages deploy") is the CI workflow's badge
for pushes to `staging`. GitHub badges are per workflow, not per job, so it
shows the whole run, not only `pages-deploy`; open the run to see that job. It
shows "no status" until the first push to `staging` has run.

### How the snapshot is made

`.github/scripts/build-pages.sh` starts the jar built by `build`, waits for
`/api/manifest`, saves `/` and the manifest, copies the static files out of the
jar, stops the app and writes `site/`:

- `manifest.json`: the real manifest, including the real `build.gitSha` and
  `build.builtAt`, with each tile's `moduleUrl` made relative.
- `index.html`: the home page with its four root-absolute URLs made relative,
  `data-manifest-url` pointing at `manifest.json`, and a footer note saying
  "Static snapshot ... not a live Spring instance".
- `404.html` (themed), `.nojekyll`, and the CSS, JS and tile modules.

The snapshot differs from what Spring serves only in those ways. The shell
resolves each tile module against the page (`main.js`), so the same code works
under Spring at `/` and under the sub-path. The build fails if the SHA is
missing or wrong, if a root-absolute URL is left in the page, or if a file the
manifest refers to is missing.

Build and test it locally:

```bash
mvn -B clean verify -Dgit.sha=$(git rev-parse HEAD)
.github/scripts/build-pages.sh                       # writes site/ (git-ignored)
cd e2e && npm ci && E2E_MODE=static npx playwright test
```

### The sub-path assumption

A project site is served under the repository name, so the site is built for
**`/jellyfish-newapp/`**. That value comes from the repository name, in three
places:

- `ci.yml` passes `PAGES_BASE_PATH=/<repository name>` to `build-pages.sh`, which
  uses it for `404.html`'s `<base href>`, and `STATIC_SUBPATH` to the static e2e
  run;
- the script and `e2e/tests/mode.js` fall back to `/jellyfish-newapp` when those
  are unset.

`actions/configure-pages`, which can report the base path, is deliberately not
used: it fails when Pages is not enabled yet, which would break `pages-build` on
every pull request until the owner had enabled Pages.

If the site is ever served from a custom domain (or a `<owner>.github.io`
user site), it is served at `/`, and that needs a code change, not only a
setting: `build-pages.sh` and `e2e/static-server.js` (with `e2e/tests/mode.js`)
treat an empty sub-path as unset and fall back to `/jellyfish-newapp`, so they
must be changed to allow an empty one, and `ci.yml` passes the repository name.
This has not been tried.

### What the static snapshot cannot show

- **No live `/api/manifest`.** `manifest.json` is a copy taken at build time. The
  Deployed apps and Runtime graph tiles read that copy; the graph shows
  `manifest.json` as its manifest URL.
- **No server-side configuration at runtime.** Changing `mfe.tiles` (or any
  Spring property) has no effect on the live site; it needs a new snapshot, that
  is a new push to `staging`. Likewise nothing the Spring app computes per
  request is live: the page and the manifest are frozen, including the build
  SHA and time.
- Spring's own behaviour (its response headers and its handling of unknown
  paths) is not reproduced; GitHub Pages serves the files and `404.html`.

### Repository settings checklist (owner)

Repository settings are changed by the repository owner; nothing in this
repository changes them.

> **Not verified by CI.** CI cannot see or change any of these settings, and I
> could not read GitHub's own documentation on the `github-pages` Environment's
> default rule (docs.github.com was not reachable), so the wording of menus and
> that default are unconfirmed. Check each one in the GitHub UI.

**GitHub Pages** (Settings -> Pages):

- [ ] Set the source to **GitHub Actions** (not "Deploy from a branch"). Until
  this is done, `pages-deploy` cannot publish.

**Environment `github-pages`** (Settings -> Environments -> `github-pages`; the
Pages deploy uses this name. It is expected to exist once Pages is set to
GitHub Actions; if it is not listed, check again after the first run):

- [ ] Deployment branches and tags: make sure **`staging` is allowed**. The
  default rule is unconfirmed. If it only allows the repository's default
  branch, that is `main` here, which is stale and not part of the flow, so
  `staging` would be rejected. Allow `staging`, and remove `main` if you do not
  want it.
- [ ] Optional: required reviewers, so that each Pages deploy waits for approval
  (the job then sits in "waiting" before any step runs; that is not a failure).

**Branch `staging`** (Settings -> Branches, a branch protection rule or a
ruleset for `staging`):

- [ ] Require a pull request before merging.
- [ ] Require status checks to pass before merging, and add exactly these seven:
  `build`, `container-image`, `sbom`, `worker`, `e2e`, `pages-build`,
  `pages-e2e`. Do **not** add `pages-deploy` or `deploy`: they only run on a
  push to `staging` and are skipped on pull requests, so they must not gate
  them.
- [ ] Block force pushes.
- [ ] Block deletion of the branch.

A check can be picked in that list only after it has run recently, so open the
PR from `develop` to `staging` first. By default administrators can bypass these
rules; there is a setting to enforce them for administrators too if you want
that.

**Environment `staging`** is needed only if you enable the Cloudflare deployment;
see [below](#cloudflare-containers-optional-dormant).

### First deploy troubleshooting

In the order to check. This is based on `pages-deploy` in `ci.yml`: its steps are
checkout, `actions/deploy-pages`, the smoke test and a summary. Where a claim
about GitHub's behaviour could not be confirmed, it says so.

0. **The job is "skipped", not failed.** `pages-deploy` runs only for a push to
   `staging` and only if its seven `needs` jobs all succeeded. A skipped job
   means the event was not a push to `staging`, or one of those jobs failed or
   was skipped; look at that job, not at Pages.
1. **Pages source not set.** Symptom to expect: the "Deploy to GitHub Pages" step
   fails. The exact message is unconfirmed. Fix: Settings -> Pages -> Source =
   GitHub Actions.
2. **The `github-pages` Environment rejects the `staging` branch.** Symptom to
   expect: the job is refused or fails before its steps run, with a message
   about the branch not being allowed to deploy to the environment (GitHub's
   general behaviour for environment branch rules; its exact wording here is
   unconfirmed, and so is the Environment's default rule). Fix: allow `staging`
   in the Environment's deployment branches. A required-reviewers rule instead
   makes the job wait.
3. **Permissions.** The job sets its own `permissions`: `contents: read`,
   `pages: write` and `id-token: write`; these replace the workflow's default
   `contents: read`, they are not added to it. If the deploy step fails with a
   token or OIDC error, check that the job still has these three and look at
   Settings -> Actions -> General (workflow permissions). Whether a repository
   or organization policy can cap them here is unconfirmed.
4. **Smoke test fails.** The site is already published when this step runs (it
   follows `deploy-pages`), and a failure does not roll it back.
   `.github/scripts/smoke-test.sh` fetches `<page_url>manifest.json` until it
   answers HTTP 200 with `build.gitSha` equal to the commit being deployed,
   retrying with backoff (5 s doubling to 30 s) until a 10-minute deadline
   (`SMOKE_DEADLINE_SECONDS: 600`; the job itself times out at 20 minutes). The
   log prints each attempt's reason (`HTTP 404`, `no HTTP response`, or
   `build.gitSha is '...', expected '...'`).
   - *HTTP 404 or an old SHA for a while:* propagation. How long Pages takes is
     unconfirmed; the script sends `Cache-Control: no-cache`, and whether Pages
     honors it is unconfirmed too. If the deadline is simply too short, re-run
     the job.
   - *The SHA is still different at the deadline:* the build step
     `pages-build` already fails if the jar's SHA is not `github.sha`, so the
     artifact itself should be right. A persistent mismatch means old content is
     still being served, or `page_url` points somewhere else (for example a
     custom domain). Check the "Summary" URL.
   - To re-run only `pages-deploy`, use "Re-run failed jobs". The Pages artifact
     is uploaded with the action's default retention, which is 1 day (per the
     action's README), so after a day the whole workflow has to run again.

## Cloudflare Containers (optional, dormant)

> **Status: on hold.** Cloudflare Containers need the Workers Paid plan, and this
> account does not have it, so nothing is deployed there. It is dormant, not
> removed: the `deploy` job is still in `ci.yml` and is skipped (not failed)
> unless the repository variable `DEPLOY_ENABLED` is `true`. To enable it later,
> set `DEPLOY_ENABLED` to `true` (Settings -> Secrets and variables -> Actions ->
> Variables) and create the two secrets described under "One-time setup" below.
> It is independent of the Pages deployment, which does not look at
> `DEPLOY_ENABLED`. The rest of this section describes how it works once
> enabled.

When enabled, a push to `staging` (a merged PR from `develop`, see
[Branch flow](#branch-flow)) runs the whole pipeline, and only if the first five
jobs pass does the `deploy` job run. It never runs on pull requests.

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

1. In **Settings -> Environments**, create an environment named `staging`, and
   optionally restrict its deployment branches to `staging` (and add required
   reviewers).
2. Create these two **secrets** (on the `staging` environment, which is
   preferred, or on the repository):
   - `CLOUDFLARE_ACCOUNT_ID`: your Cloudflare account ID.
   - `CLOUDFLARE_API_TOKEN`: an **Account API token** scoped to that one account
     only. In the Cloudflare token UI a permission is a name plus a separate
     level (Read or Edit). Start from the **Edit Cloudflare Workers** template
     (the one Cloudflare's GitHub Actions guide uses) and **add** the permissions
     **Containers** and **Cloudchamber**, each with the level **Edit**.
3. Optional: a **variable** (not a secret) `STAGING_URL` with the deployment's
   `https://` URL. Without it the job uses the URL Wrangler prints.
4. Set the variable `DEPLOY_ENABLED` to `true`.

About the token: Cloudflare's CI guide names only the template above, and its
Containers documentation does not spell out what a deploy needs. Containers and
Cloudchamber both need **Edit**, which matches the `containers:write` and
`cloudchamber:write` scopes Wrangler itself requests when you log in. The first
deploy can take several minutes while Cloudflare provisions the image. If a
deploy fails, note that the Actions log may show only that a Cloudflare API
request failed; Wrangler's own log file, which has the detail, is not uploaded.

## Roadmap

Production is the GitHub Pages snapshot (see
[Production deployment](#production-deployment)); the Cloudflare path is dormant.
These are options that were considered for later. None of them is a commitment.

- **A static build on Workers:** serve the static snapshot from Cloudflare
  Workers instead of, or as well as, GitHub Pages; it does not need a container.
- **A free container host:** run the existing Docker image on a host with a free
  tier.
- **Publishing the image to GHCR:** have CI publish the container image to the
  GitHub Container Registry, so it can be pulled and run anywhere.

## Inspiration

The architecture (shell, manifest, independently loaded remotes, fault
isolation, runtime graph) is inspired by a micro-frontend demo that was
published at `tg-labs-mfe.gioitv-dev.workers.dev`. That site is now private, so
its license could not be verified. This project takes inspiration from the
architecture only. It is an independent implementation: no code, copy or
content from that site was copied or used.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

Copyright 2026 Jellyfish Ng; see [NOTICE](NOTICE).

Third-party components are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Note that `w3.css` and
`w3-colors-win8.css` are bundled in this repository on purpose, so the page
(and the Pages site and Cloudflare deployment) has no external runtime dependency, even though
their licensing is unclear: W3Schools says W3.CSS is free to use but publishes
no license text.
