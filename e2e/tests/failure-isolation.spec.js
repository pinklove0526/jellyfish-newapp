import { test, expect } from '@playwright/test';
import { MANIFEST_GLOB } from './mode.js';
import { tile, openShell, watch, modal, openPanel, closePanel, settled, expectTasksStillWork, fulfillModule, TOTAL } from './helpers.js';

// Every failure here is injected from the test with page.route(); the app is
// served unmodified. The Broken demo tile is always unavailable, so a page with
// one injected failure has two unavailable tiles and TOTAL - 2 live ones.

const unavailable = (page, id) => tile(page, id).locator(':scope.unavailable');

test.describe('a tile that fails to load becomes "unavailable" and the others keep working', () => {
	test('hung module: times out after about 5 s', async ({ page }) => {
		const seen = watch(page);
		// Never answered: the browser waits for this request until the page closes.
		await page.route('**/tiles/weather/v1/index.js', () => {});
		await page.goto('./');

		// Everything else is live long before the timeout...
		await expect(page.locator('.tile .version')).toHaveCount(TOTAL - 2);
		const started = Date.now();
		await expect(tile(page, 'weather')).not.toHaveClass(/unavailable/);
		await expectTasksStillWork(page);

		// ...and then the hung tile gives up.
		await expect(unavailable(page, 'weather')).toBeVisible({ timeout: 10_000 });
		const waited = Date.now() - started;
		expect(waited).toBeLessThan(6_000);
		await expect(tile(page, 'weather')).toContainText('timed out after 5000 ms');
		await settled(page);
		await expect(page.locator('#status-message')).toHaveText('Ready · 2 tiles unavailable');
		expect(seen.pageErrors).toEqual([]);

		await openPanel(page, 'graph');
		await expect(modal(page).extra).toContainText('Weather failed: timed out after 5000 ms');
	});

	test('404 module', async ({ page }) => {
		const seen = watch(page);
		await page.route('**/tiles/store/v1/index.js', (route) => route.fulfill({ status: 404, body: 'not found' }));
		await page.goto('./');
		await settled(page);
		await expect(unavailable(page, 'store')).toBeVisible();
		await expect(unavailable(page, 'store')).toContainText('Failed to fetch dynamically imported module');
		await expect(tile(page, 'store')).toBeDisabled();
		await expectTasksStillWork(page);
		expect(seen.pageErrors).toEqual([]);

		// The diagnostics tiles report it.
		await expect(tile(page, 'graph').locator('[data-role="ratio"]')).toHaveText('11/13');
		await expect(tile(page, 'graph').locator('[data-role="caption"]')).toHaveText('tiles live · 2 failed');
		await openPanel(page, 'deployed');
		await expect(modal(page).body).toHaveText('11 of 13 tiles are live.');
		await expect(modal(page).extra.locator('tr', { hasText: 'Store' })).toContainText('failed');
	});

	test('module without mount()', async ({ page }) => {
		await page.route('**/tiles/settings/v1/index.js', fulfillModule('export const nothing = 1;'));
		await page.goto('./');
		await settled(page);
		await expect(unavailable(page, 'settings')).toContainText('module has no mount()');
		await expectTasksStillWork(page);
	});

	test('module with a syntax error', async ({ page }) => {
		await page.route('**/tiles/photos/v1/index.js', fulfillModule('export function mount( {'));
		await page.goto('./');
		await settled(page);
		await expect(unavailable(page, 'photos')).toBeVisible();
		await expectTasksStillWork(page);
	});

	test('mount() that throws: the shell calls unmount() so nothing it started keeps running', async ({ page }) => {
		const seen = watch(page);
		await page.route('**/tiles/clock/v1/index.js', fulfillModule(`
			let timer;
			export function mount() {
				timer = setInterval(() => console.warn('leaked timer from the clock tile'), 500);
				throw new Error('injected mount failure');
			}
			export function unmount() { clearInterval(timer); globalThis.__clockUnmounted = true; }
		`));
		await page.goto('./');
		await settled(page);
		await expect(unavailable(page, 'clock')).toContainText('injected mount failure');
		expect(await page.evaluate(() => globalThis.__clockUnmounted)).toBe(true);
		await page.waitForTimeout(1200);
		expect(seen.warnings.filter((w) => w.includes('leaked timer'))).toEqual([]);
		await expectTasksStillWork(page);
	});
});

test.describe('a tile that fails after loading is contained', () => {
	const brokenStore = (detail) => fulfillModule(`
		export function mount(el) { el.innerHTML = '<span class="label">Store</span>'; }
		export function unmount() {}
		${detail}
	`);

	test('detail() that throws: the panel explains and the page keeps working', async ({ page }) => {
		const seen = watch(page);
		await page.route('**/tiles/store/v1/index.js', brokenStore(`export function detail() { throw new Error('boom'); }`));
		await page.goto('./');
		await settled(page);
		await openPanel(page, 'store');
		await expect(modal(page).body).toHaveText('Details are unavailable: boom');
		await closePanel(page);
		await expectTasksStillWork(page);
		expect(seen.pageErrors).toEqual([]);
	});

	test('an action that throws: status bar reports it, the panel closes and the page keeps working', async ({ page }) => {
		const seen = watch(page);
		await page.route('**/tiles/store/v1/index.js', brokenStore(`
			export function detail() { return { body: 'ok', actions: [{ label: 'Explode', onClick() { throw new Error('bang'); } }] }; }
		`));
		await page.goto('./');
		await settled(page);
		await openPanel(page, 'store');
		await modal(page).actions.filter({ hasText: 'Explode' }).click();
		await expect(page.locator('#status-message')).toHaveText('"Explode" failed: bang');
		await expect(page.locator('#tile-modal')).toBeHidden();
		await expectTasksStillWork(page);
		expect(seen.pageErrors).toEqual([]);
	});
});

test.describe('a failed manifest request', () => {
	const cases = {
		'HTTP 500': (route) => route.fulfill({ status: 500, body: 'down' }),
		'network error': (route) => route.abort('connectionrefused'),
		'invalid JSON': (route) => route.fulfill({ status: 200, contentType: 'application/json', body: 'not json' }),
	};
	for (const [name, handler] of Object.entries(cases)) {
		test(`${name}: the shell says so and does not crash`, async ({ page }) => {
			const seen = watch(page);
			await page.route(MANIFEST_GLOB, handler);
			await page.goto('./');
			await expect(page.locator('#groups')).toContainText('The tile manifest is unavailable.');
			await expect(page.locator('#status-message')).toHaveText('Manifest unavailable');
			await expect(page.locator('.tile')).toHaveCount(0);
			// The shell itself is still alive: the status clock keeps ticking.
			const first = await page.locator('#status-time').textContent();
			await expect.poll(() => page.locator('#status-time').textContent()).not.toBe(first);
			expect(seen.pageErrors).toEqual([]);
		});
	}
});
