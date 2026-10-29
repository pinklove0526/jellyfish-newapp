# jellyfish-newapp

[![CI](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml?query=branch%3Adevelop)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

A Windows 8 "Metro"-style Start screen served by Spring Boot, and a small
**micro-frontend (MFE) concept lab**: a place to try out the moving parts of a
micro-frontend architecture with no framework and no bundler, just Spring MVC,
vanilla JavaScript and [w3.css](https://www.w3schools.com/w3css/).

> **Status:** every micro-frontend feature in the table below is built. Tests
> for the manifest and home controller are still planned.

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

## Build and deploy

- **Container:** the `Dockerfile` builds the jar with Microsoft Build of
  OpenJDK 17 and Maven, and runs it on the OpenJDK 17 distroless image as a
  non-root user, listening on port 8080.
- **Cloudflare:** `worker/index.ts` and `wrangler.jsonc` define a Worker that
  starts the container on Cloudflare Containers (`standard-1` instance, no
  outbound internet) and proxies every request to it. Deployment is manual
  today (`npm run deploy`, with Cloudflare credentials); automatic deployment is
  not set up.
- **Build info:** `/api/manifest` includes the app version, build time and the
  git SHA the build was made from. Pass the SHA with `-Dgit.sha=<sha>` (CI does)
  or `--build-arg GIT_SHA=<sha>` for `docker build`; otherwise it shows
  `unknown`. A manual `wrangler deploy` builds from the `Dockerfile` without a
  SHA, so the deployed page shows `unknown` unless one is supplied.
- **CI** (`.github/workflows/ci.yml`) has four jobs:
  - `build`: `mvn verify` inside the OpenJDK 17 image.
  - `container-image`: builds the image and smoke-tests it at `standard-1`
    limits.
  - `sbom`: [BomLens](https://github.com/sktelecom/bomlens) generates an SBOM,
    notice, and security and license reports (uploaded as the `sbom`
    artifact). Vulnerabilities are report-only; a known malicious package
    fails the job.
  - `worker`: type-checks the Worker and runs a dry-run deploy.

## Inspiration

The architecture (shell, manifest, independently loaded remotes, fault
isolation, runtime graph) is inspired by the micro-frontend demo at
<https://tg-labs-mfe.gioitv-dev.workers.dev/>. This project is an independent
implementation: no code, copy or content from that site is used.

## License

Licensed under the [Apache License, Version 2.0](LICENSE).

Third-party components, including some whose licensing is unclear, are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
