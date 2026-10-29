import { test, expect } from '@playwright/test';
import { TILES, LIVE_TILES, TOTAL, tile, openShell, watch, modal, openPanel, closePanel } from './helpers.js';

test.describe('all tiles render', () => {
	test('13 frames in three groups, in manifest order', async ({ page }) => {
		await openShell(page);
		await expect(page.locator('.group h2')).toHaveText(['Overview', 'Apps', 'Diagnostics']);
		await expect(page.locator('.tile')).toHaveCount(TOTAL);
		const ids = await page.locator('.tile').evaluateAll((els) => els.map((e) => e.dataset.tile));
		expect(ids).toEqual(TILES.map((t) => t.id));
	});

	test('every tile except the Broken demo is live and shows its version', async ({ page }) => {
		await openShell(page);
		for (const { id } of LIVE_TILES) {
			await expect(tile(page, id)).not.toHaveClass(/unavailable/);
			await expect(tile(page, id).locator('.version')).toHaveText('v1.0.0');
		}
		await expect(tile(page, 'broken')).toHaveClass(/unavailable/);
		await expect(tile(page, 'broken')).toContainText('deliberate failure in mount()');
	});

	test('tiles are fetched from versioned module paths', async ({ page }) => {
		const modules = [];
		page.on('request', (r) => { if (r.url().includes('/tiles/')) modules.push(new URL(r.url()).pathname); });
		await openShell(page);
		expect(modules.sort()).toEqual(TILES.map((t) => `/tiles/${t.id}/v1/index.js`).sort());
	});

	test('the status bar reports the unavailable tile', async ({ page }) => {
		await openShell(page);
		await expect(page.locator('#status-message')).toHaveText('Ready · 2 tiles unavailable');
	});
});

test.describe('happy path is quiet', () => {
	test('no page errors, no failed requests, and the only console error is the Broken demo tile', async ({ page }) => {
		const seen = watch(page);
		await openShell(page);
		// Long enough for the Broken demo tile's leaked timer (1 s period) to fire if unmount() had not stopped it.
		await page.waitForTimeout(2600);
		expect(seen.pageErrors).toEqual([]);
		expect(seen.badResponses).toEqual([]);
		expect(seen.errors).toHaveLength(1);
		expect(seen.errors[0]).toContain('Tile "broken" is unavailable');
		expect(seen.warnings.filter((w) => w.includes('broken tile'))).toEqual([]);
	});
});

test.describe('each tile opens its detail panel', () => {
	for (const { id, title } of LIVE_TILES) {
		test(`${id}: panel shows its title and module path, and Escape closes it`, async ({ page }) => {
			await openShell(page);
			const m = modal(page);
			await openPanel(page, id);
			await expect(m.title).toHaveText(title);
			await expect(m.body).not.toBeEmpty();
			await expect(m.meta).toHaveText(`Module /tiles/${id}/v1/index.js · v1.0.0`);
			await closePanel(page);
		});
	}

	test('clicking the backdrop closes the panel', async ({ page }) => {
		await openShell(page);
		await openPanel(page, 'clock');
		await page.locator('#tile-modal').click({ position: { x: 5, y: 5 } });
		await expect(page.locator('#tile-modal')).toBeHidden();
	});

	test('a tile that is unavailable cannot be opened', async ({ page }) => {
		await openShell(page);
		await expect(tile(page, 'broken')).toBeDisabled();
	});
});

test.describe('tile actions', () => {
	test('Mail: Mark all read clears the badge and closes the panel', async ({ page }) => {
		await openShell(page);
		await expect(tile(page, 'mail').locator('[data-role="count"]')).toHaveText('3');
		await openPanel(page, 'mail');
		await expect(modal(page).body).toHaveText('You have 3 unread messages.');
		await modal(page).actions.filter({ hasText: 'Mark all read' }).click();
		await expect(tile(page, 'mail').locator('[data-role="count"]')).toHaveText('0');
		await expect(page.locator('#status-message')).toHaveText('All mail marked as read');
		await expect(page.locator('#tile-modal')).toBeHidden();
	});

	test('Server: Check now refreshes the reading', async ({ page }) => {
		await openShell(page);
		await openPanel(page, 'server');
		await expect(modal(page).body).toHaveText(/^Status: (Online|Degraded), latency \d+ ms\.$/);
		await modal(page).actions.filter({ hasText: 'Check now' }).click();
		await expect(page.locator('#status-message')).toHaveText('Server status refreshed');
		await expect(tile(page, 'server').locator('[data-role="state"]')).toHaveText(/^(Online|Degraded)$/);
	});

	test('Tasks: Complete one counts down to "All caught up."', async ({ page }) => {
		await openShell(page);
		const count = tile(page, 'tasks').locator('[data-role="count"]');
		await expect(count).toHaveText('5');
		for (let left = 4; left >= 0; left--) {
			await openPanel(page, 'tasks');
			await modal(page).actions.filter({ hasText: 'Complete one' }).click();
			await expect(count).toHaveText(String(left));
			await expect(page.locator('#status-message')).toHaveText(`Task completed — ${left} left`);
		}
		await openPanel(page, 'tasks');
		await expect(modal(page).body).toHaveText('All caught up.');
		await expect(modal(page).actions).toHaveCount(0);
	});

	test('Music: Play starts a track, then the action becomes Next track', async ({ page }) => {
		await openShell(page);
		await openPanel(page, 'music');
		await expect(modal(page).body).toHaveText('Nothing playing.');
		await modal(page).actions.filter({ hasText: 'Play' }).click();
		await expect(tile(page, 'music').locator('[data-role="track"]')).toHaveText('Ocean Drift · Tidal');
		await expect(page.locator('#status-message')).toHaveText('Playing Ocean Drift · Tidal');
		await openPanel(page, 'music');
		await expect(modal(page).body).toHaveText('Now playing: Ocean Drift · Tidal.');
		await modal(page).actions.filter({ hasText: 'Next track' }).click();
		await expect(tile(page, 'music').locator('[data-role="track"]')).toHaveText('Neon Rain · Static Bloom');
	});
});

test.describe('event bus demo: Tasks -> Calendar', () => {
	test('the Calendar tile follows the Tasks tile, including late-subscriber replay', async ({ page }) => {
		await openShell(page);
		const due = tile(page, 'calendar').locator('[data-role="due"]');
		// Tiles load concurrently, so Calendar may mount before Tasks has published: this only passes with replay.
		await expect(due).toHaveText('5 tasks due');
		for (const left of [4, 3, 2, 1]) {
			await openPanel(page, 'tasks');
			await modal(page).actions.first().click();
			await expect(due).toHaveText(left === 1 ? '1 task due' : `${left} tasks due`);
		}
		await openPanel(page, 'calendar');
		await expect(modal(page).body).toContainText('1 task is due (from the Tasks tile).');
	});

	test('bus.js: replay, unsubscribe and argument checking', async ({ page }) => {
		await page.goto('/');
		const result = await page.evaluate(async () => {
			const { createBus } = await import('/js/bus.js');
			const bus = createBus();
			const got = [];
			bus.emit('a:x', 1);
			const off = bus.on('a:x', (d) => got.push('replayed:' + d), { replay: true });
			bus.on('a:y', (d) => got.push('y:' + d));
			bus.emit('a:x', 2);
			off();
			bus.emit('a:x', 3);
			bus.emit('a:y', 4);
			let bad = '';
			try { bus.emit('', 1); } catch (e) { bad = e.constructor.name; }
			return { got, bad };
		});
		expect(result.got).toEqual(['replayed:1', 'replayed:2', 'y:4']);
		expect(result.bad).toBe('TypeError');
	});
});

test.describe('diagnostics tiles', () => {
	test('Runtime graph: face summary and the full graph', async ({ page }) => {
		await openShell(page);
		const face = tile(page, 'graph');
		await expect(face.locator('[data-role="ratio"]')).toHaveText('12/13');
		await expect(face.locator('[data-role="caption"]')).toHaveText('tiles live · 1 failed');

		await openPanel(page, 'graph');
		const m = modal(page);
		await expect(m.body).toHaveText('12 live, 1 failed, 0 loading, 0 disabled.');
		await expect(m.extra.locator('svg rect')).toHaveCount(15); // shell + manifest + 13 tiles
		await expect(m.extra.locator('svg path')).toHaveCount(13); // manifest -> each tile
		await expect(m.extra).toContainText('Manifest /api/manifest: live');
		await expect(m.extra).toContainText('Broken demo failed: deliberate failure in mount()');
		await expect(m.extra.locator('svg text', { hasText: /^live · \d+ ms$/ })).toHaveCount(12);
		await expect(m.extra.locator('svg text', { hasText: /^failed$/ })).toHaveCount(1);
	});

	test('Deployed apps: build info matches /api/manifest, and every tile is listed with its status', async ({ page, request }) => {
		const { build } = await (await request.get('/api/manifest')).json();
		expect(build.app).toBe('jellyfish-newapp');
		if (process.env.E2E_EXPECTED_SHA) {
			expect(build.gitSha).toBe(process.env.E2E_EXPECTED_SHA);
		}
		const shortSha = /^[0-9a-f]{40}$/.test(build.gitSha) ? build.gitSha.slice(0, 7) : build.gitSha;

		await openShell(page);
		const face = tile(page, 'deployed');
		await expect(face.locator('[data-role="sha"]')).toHaveText(shortSha);
		await expect(face.locator('[data-role="app"]')).toHaveText('v' + build.version);
		await expect(face.locator('[data-role="built"]')).toHaveText(/^built /);

		await openPanel(page, 'deployed');
		const m = modal(page);
		await expect(m.body).toHaveText('12 of 13 tiles are live.');
		await expect(m.extra).toContainText(build.gitSha);
		const rows = m.extra.locator('table').last().locator('tr');
		await expect(rows).toHaveCount(TOTAL + 1); // header + one per tile
		for (const { id, title } of TILES) {
			const row = rows.filter({ hasText: title });
			await expect(row).toContainText(`/tiles/${id}/v1/index.js`);
			await expect(row).toContainText(id === 'broken' ? 'failed' : 'live');
		}
	});
});

test.describe('mobile layout (390 px)', () => {
	test.use({ viewport: { width: 390, height: 900 } });

	test('renders every tile without horizontal overflow', async ({ page }, testInfo) => {
		await openShell(page);
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
		const boxes = await page.locator('.tile').evaluateAll((els) =>
			els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.tile, left: r.left, right: r.right, width: r.width }; }));
		expect(boxes).toHaveLength(TOTAL);
		for (const b of boxes) {
			expect(b.left, `${b.id} left edge`).toBeGreaterThanOrEqual(0);
			expect(b.right, `${b.id} right edge`).toBeLessThanOrEqual(390);
			expect(b.width, `${b.id} width`).toBeGreaterThan(100);
		}
		await testInfo.attach('mobile-layout', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
	});

	test('a tile still opens its panel', async ({ page }) => {
		await openShell(page);
		await openPanel(page, 'tasks');
		await expect(modal(page).title).toHaveText('Tasks');
		await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
	});
});
