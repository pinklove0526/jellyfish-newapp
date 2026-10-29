# jellyfish-newapp

[![CI](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml/badge.svg?branch=develop)](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml?query=branch%3Adevelop)
[![License: Apache-2.0](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)

A Windows 8 "Metro"-style Start screen served by Spring Boot, and a small
**micro-frontend (MFE) concept lab**: a place to try out the moving parts of a
micro-frontend architecture with no framework and no bundler, just Spring MVC,
vanilla JavaScript and [w3.css](https://www.w3schools.com/w3css/).

> **Status:** today the project is a single-page dashboard whose tiles are
> hard-coded in one template and one script. The micro-frontend features below
> are the plan, and are marked *planned* until they are built.

## Micro-frontend concept mapping

| Concept | In this project | Status |
|---|---|---|
| **Shell** | The Start screen: fetches the manifest, renders tiles, loads each one | planned (today: one `main.js` drives every tile) |
| **Manifest** | `GET /api/manifest` lists each tile's id, title, version, module URL and enabled flag, read from `application.properties` | planned |
| **Independently loaded remotes** | Each tile is an ES module under `static/js/tiles/<id>/`, loaded with dynamic `import()` and exposing `mount(el)` / `unmount()` | planned |
| **Versioned paths** | Tiles are served from `/tiles/<id>/v1/...` and show their version | planned |
| **Cross-tile messaging** | A tiny `CustomEvent` bus, with one demo pair of tiles | planned |
| **Fault isolation** | `try/catch` plus a timeout per tile, an "unavailable" state, and a deliberately broken demo tile to show the shell survives | planned |
| **Runtime graph** | A tile drawing shell → manifest → tiles with live/failed status | planned |
| **Deployed apps** | A tile built from the manifest plus build info (git SHA, build time) | planned |

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
