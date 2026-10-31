import { test, expect } from '@playwright/test';
import { MODE, SITE_PATH, MANIFEST_REL } from './mode.js';
import { openShell, settled, watch } from './helpers.js';

// Checks that only make sense for the GitHub Pages snapshot. In the live run
// they are reported as skipped ("static-only"), never silently absent.
test.describe('static snapshot (E2E_MODE=static)', () => {
	test.skip(MODE !== 'static', 'static-only: these check the Pages snapshot, not the Spring app');

	test('loads at the exact site path with its trailing slash', async ({ page }) => {
		const response = await page.goto(SITE_PATH + '/');
		expect(response.status()).toBe(200);
		expect(new URL(page.url()).pathname).toBe(SITE_PATH + '/');
		await settled(page);
	});

	test('the site path without the slash redirects to it (as GitHub Pages does)', async ({ page }) => {
		await page.goto(SITE_PATH);
		expect(new URL(page.url()).pathname).toBe(SITE_PATH + '/');
		await settled(page);
	});

	test('every request stays under the site path (no root-absolute URL)', async ({ page }) => {
		const seen = watch(page);
		const outside = [];
		page.on('request', (r) => {
			const { pathname } = new URL(r.url());
			if (!pathname.startsWith(SITE_PATH + '/')) outside.push(pathname);
		});
		await openShell(page);
		expect(outside).toEqual([]);
		expect(seen.badResponses).toEqual([]);
	});

	test('the footer says this is a static snapshot, not a live Spring instance', async ({ page }) => {
		await openShell(page);
		const note = page.locator('#snapshot-note');
		await expect(note).toContainText('Static snapshot');
		await expect(note).toContainText('not a live Spring instance');
		const { build } = await (await page.request.get(MANIFEST_REL)).json();
		await expect(note).toContainText('built from ' + build.gitSha.slice(0, 7));
		// The shell's own status line is untouched by the marker.
		await expect(page.locator('#status-message')).toHaveText('Ready · 1 tile unavailable');
	});

	test('manifest.json is the real manifest: build info and relative module URLs', async ({ request }) => {
		const manifest = await (await request.get(MANIFEST_REL)).json();
		expect(manifest.build.app).toBe('jellyfish-newapp');
		expect(manifest.build.gitSha).toMatch(/^[0-9a-f]{40}$/);
		expect(Number.isNaN(Date.parse(manifest.build.builtAt))).toBe(false);
		expect(manifest.tiles).toHaveLength(13);
		for (const t of manifest.tiles) expect(t.moduleUrl).toMatch(/^tiles\/[a-z-]+\/v1\/index\.js$/);
	});

	test('.nojekyll is published, and a missing page gets the themed 404', async ({ request }) => {
		expect((await request.get('.nojekyll')).status()).toBe(200);
		const missing = await request.get('no/such/page');
		expect(missing.status()).toBe(404);
		expect(await missing.text()).toContain('<h1>Not found</h1>');
	});

	test('the 404 page renders with its styles at any depth', async ({ page }) => {
		const failed = [];
		page.on('response', (r) => { if (r.url().endsWith('.css') && r.status() !== 200) failed.push(r.url()); });
		const response = await page.goto(SITE_PATH + '/deep/missing/page');
		expect(response.status()).toBe(404);
		await expect(page.locator('h1')).toHaveText('Not found');
		await expect(page.locator('a.back')).toHaveAttribute('href', './');
		await page.locator('a.back').click();
		expect(new URL(page.url()).pathname).toBe(SITE_PATH + '/');
		expect(failed).toEqual([]);
	});
});
