// The same specs run against two builds of the app (E2E_MODE):
//   live    the Spring Boot app, served at / (default)
//   static  the GitHub Pages snapshot, served by static-server.js under a sub-path
// Everything that differs between the two is here, so a spec never branches on
// the mode itself. URLs are used relative to the base URL (which ends in "/"),
// so they keep working under the sub-path.
export const MODE = process.env.E2E_MODE === 'static' ? 'static' : 'live';
if (process.env.E2E_MODE && !['live', 'static'].includes(process.env.E2E_MODE)) {
	throw new Error(`E2E_MODE must be "live" or "static", got "${process.env.E2E_MODE}"`);
}

const withSlash = (url) => (url.endsWith('/') ? url : url + '/');

export const STATIC_SUBPATH = process.env.STATIC_SUBPATH || '/jellyfish-newapp';
export const STATIC_PORT = process.env.STATIC_PORT || '8081';
export const BASE_URL = withSlash(
	MODE === 'static'
		? process.env.BASE_URL || `http://localhost:${STATIC_PORT}${STATIC_SUBPATH}/`
		: process.env.BASE_URL || 'http://localhost:8080/'
);
// "" for the live app, "/jellyfish-newapp" for the snapshot.
export const SITE_PATH = new URL(BASE_URL).pathname.replace(/\/$/, '');

// Where the shell gets its manifest. REL is for requests, ATTR is the value the
// shell shows in the Runtime graph (the page's data-manifest-url as served).
export const MANIFEST_REL = MODE === 'static' ? 'manifest.json' : 'api/manifest';
export const MANIFEST_ATTR = MODE === 'static' ? 'manifest.json' : '/api/manifest';
export const MANIFEST_GLOB = `**/${MANIFEST_REL}`;

// A tile's moduleUrl exactly as the manifest carries it, and its URL path on the wire.
export const moduleUrl = (id) => (MODE === 'static' ? '' : '/') + `tiles/${id}/v1/index.js`;
export const modulePathname = (id) => `${SITE_PATH}/tiles/${id}/v1/index.js`;
