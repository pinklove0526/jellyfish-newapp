# Third-party notices

jellyfish-newapp itself is licensed under Apache-2.0 (see [LICENSE](LICENSE)).
It bundles or depends on the third-party components below. This file is a
best-effort inventory, not legal advice. Anything marked **UNCLEAR** could not be
confirmed from the component's own files, and is listed so it is not forgotten.

## Bundled front-end files

These files are copied into the repository and served to browsers.

| File | What it is | Licensing |
|---|---|---|
| `src/main/resources/static/css/w3.css` | W3.CSS 4.15 (December 2020), by Jan Egil and Borge Refsnes (W3Schools / Refsnes Data) | **UNCLEAR** (see below) |
| `src/main/resources/static/css/w3-colors-win8.css` | Windows 8 colour classes (`w3-win8-*`) in the style of W3Schools' colour files | **UNCLEAR** (see below) |

### W3.CSS (`w3.css`)

- The file's header credits "W3.CSS 4.15 December 2020 by Jan Egil and Borge
  Refsnes". It also embeds an extract of
  [normalize.css](https://github.com/necolas/normalize.css) by Nicolas Gallagher
  and Jonathan Neal, which is MIT-licensed upstream. The header does not say so,
  and this file does not reproduce the MIT text.
- W3Schools states on its [W3.CSS downloads page](https://www.w3schools.com/W3CSS/w3css_downloads.asp)
  that W3.CSS is free to use and needs no license, and its tutorial calls the
  framework open source. W3Schools pages also carry a "Copyright Refsnes Data"
  notice.
- **No license text was found** (no SPDX identifier, no license file, no license
  in the CSS header). "Free to use" is not a named open-source license, and it
  does not say whether *redistributing* the file in a public repository is
  allowed.

**Decision:** both CSS files are bundled intentionally and are served by the app
itself, with no CDN, so the Cloudflare deployment has no external runtime
dependency. The licensing question above stays open; if it ever needs closing,
the routes are written permission from W3Schools or replacing the file with a
library under a known license.

### Windows 8 colours (`w3-colors-win8.css`)

- The file has no header, copyright or license text, and the repository does not
  record where it came from. The `w3-win8-*` class names match W3Schools'
  colour-theme files, so it probably comes from there, but that is an inference.
- The colour values are the Windows 8 / Metro palette. Individual colour values
  are not copyrightable on their own; the file as a whole is still **UNCLEAR**
  for the same reason as `w3.css`.

## Runtime Java dependencies

Resolved by `mvn dependency:list` at the current `pom.xml` (Spring Boot 3.2.0),
40 artifacts. Licenses were read from each artifact's POM, parent POM, or bundled
license file. Versions are those of the current `pom.xml`; regenerate this section when the
dependencies change.

**Apache-2.0** (35): Spring Boot 3.2.0 (`spring-boot`, `-autoconfigure`,
`-devtools` and the `-starter`, `-starter-json`, `-starter-logging`,
`-starter-thymeleaf`, `-starter-tomcat`, `-starter-web` artifacts);
Spring Framework 6.1.1 (`aop`, `beans`, `context`, `core`, `expression`, `jcl`,
`web`, `webmvc`); Apache Tomcat Embed 10.1.16 (`core`, `el`, `websocket`);
Jackson 2.15.3 (`annotations`, `core`, `databind`, `datatype-jdk8`,
`datatype-jsr310`, `module-parameter-names`); Apache Log4j 2.21.1 (`log4j-api`,
`log4j-to-slf4j`); Micrometer 1.12.0 (`commons`, `observation`); Thymeleaf
3.1.2 (`thymeleaf`, `thymeleaf-spring6`); AttoParser 2.0.7; Unbescape 1.1.6;
SnakeYAML 2.2.

**MIT** (2): SLF4J 2.0.9 (`slf4j-api`, `jul-to-slf4j`). The license text was read
from the `slf4j-api` jar.

**EPL-1.0 or LGPL-2.1, your choice** (2): Logback 1.4.11 (`logback-classic`,
`logback-core`). Declared in the Logback parent POM. Both are weak-copyleft terms; this
project uses Logback unmodified as a library, but check the license terms
yourself if you redistribute it.

**EPL-2.0 or GPL-2.0 with Classpath Exception** (1): `jakarta.annotation-api`
2.1.1.

Notes:

- `spring-boot-devtools` is `optional` in `pom.xml`, and
  `spring-boot-maven-plugin` leaves it out of the executable jar by default, so
  it should not ship in the container. This was not checked by unpacking the jar.
- The BomLens run in CI produces a fuller, regenerated notice
  (`*_NOTICE.txt` / `*_NOTICE.html`) in the `sbom` artifact of each
  [CI run](https://github.com/pinklove0526/jellyfish-newapp/actions/workflows/ci.yml).
  That artifact could not be downloaded when this file was written, so this list
  comes from Maven instead, and BomLens's own copyleft findings are not
  reproduced here.

## Inspiration (not a dependency)

The micro-frontend architecture is inspired by a demo that was published at
`tg-labs-mfe.gioitv-dev.workers.dev`. That site is now private, so its license
could not be verified. Only its architecture inspired this project; nothing from
it (code, copy or content) was copied.

## Not covered

- Test-only dependencies (`spring-boot-starter-test` and its dependencies) are not
  shipped.
- The Cloudflare Worker's development tooling (`wrangler`, `typescript`, listed in
  `package.json`) is not shipped to users and was not audited here.
- The Docker base images (Microsoft Build of OpenJDK 17 and its distroless
  variant) carry their own licenses and were not audited here.
