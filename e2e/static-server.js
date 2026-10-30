// A plain static file server for the Pages snapshot, used by the static e2e run.
// It mimics what GitHub Pages does for a project site and nothing more:
//   - the site lives under a sub-path (default /jellyfish-newapp/), and
//     everything outside it is a plain 404, so a root-absolute URL in the
//     snapshot cannot work by accident;
//   - the sub-path without its trailing slash redirects to the slash;
//   - a missing file under the sub-path answers 404 with the site's 404.html.
// Usage: node static-server.js <site-dir> <sub-path> <port>
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';

const [dir = '../site', prefix = '/jellyfish-newapp', port = '8081'] = process.argv.slice(2);
const root = resolve(dir);
const base = prefix.replace(/\/+$/, '');

const TYPES = {
	'.html': 'text/html; charset=utf-8',
	'.js': 'text/javascript; charset=utf-8',
	'.css': 'text/css; charset=utf-8',
	'.json': 'application/json; charset=utf-8',
	'.txt': 'text/plain; charset=utf-8',
};

async function send(res, status, file) {
	const body = await readFile(file);
	res.writeHead(status, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
	res.end(body);
}

createServer(async (req, res) => {
	try {
		const { pathname } = new URL(req.url, 'http://localhost');
		if (pathname === base) {
			res.writeHead(301, { Location: base + '/' });
			return res.end();
		}
		if (!pathname.startsWith(base + '/')) {
			res.writeHead(404, { 'Content-Type': 'text/plain' });
			return res.end('Not found (outside ' + base + '/)');
		}
		let rel = decodeURIComponent(pathname.slice(base.length + 1));
		let file = normalize(join(root, rel));
		if (file !== root && !file.startsWith(root + sep)) {
			res.writeHead(403);
			return res.end();
		}
		const info = await stat(file).catch(() => null);
		if (info && info.isDirectory()) file = join(file, 'index.html');
		const found = await stat(file).catch(() => null);
		if (found && found.isFile()) return await send(res, 200, file);
		return await send(res, 404, join(root, '404.html'));
	} catch (error) {
		res.writeHead(500, { 'Content-Type': 'text/plain' });
		res.end(String(error));
	}
}).listen(Number(port), '127.0.0.1', () => console.log(`serving ${root} at http://127.0.0.1:${port}${base}/`));
