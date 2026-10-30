import { expect } from '@playwright/test';

// Every tile in application.yml, in manifest order. "broken" is the
// deliberately broken demo tile: it is expected to be unavailable.
export const TILES = [
	{ id: 'clock', title: 'Clock' },
	{ id: 'mail', title: 'Mail' },
	{ id: 'calendar', title: 'Calendar' },
	{ id: 'server', title: 'Server status' },
	{ id: 'photos', title: 'Photos' },
	{ id: 'tasks', title: 'Tasks' },
	{ id: 'weather', title: 'Weather' },
	{ id: 'music', title: 'Music' },
	{ id: 'store', title: 'Store' },
	{ id: 'settings', title: 'Settings' },
	{ id: 'graph', title: 'Runtime graph' },
	{ id: 'deployed', title: 'Deployed apps' },
	{ id: 'broken', title: 'Broken demo' },
];
export const LIVE_TILES = TILES.filter((t) => t.id !== 'broken');
export const TOTAL = TILES.length;

export const tile = (page, id) => page.locator(`[data-tile="${id}"]`);

// A tile that loaded shows a version badge; one that failed has the
// "unavailable" class. When every frame has one or the other, loading is done.
export async function settled(page, total = TOTAL) {
	await expect(page.locator('.tile')).toHaveCount(total);
	await expect(page.locator('.tile:not(.unavailable) .version, .tile.unavailable')).toHaveCount(total);
}

export async function openShell(page) {
	await page.goto('/');
	await settled(page);
}

// Collects what the page reports about itself, for "nothing went wrong" checks.
export function watch(page) {
	const seen = { errors: [], warnings: [], pageErrors: [], badResponses: [] };
	page.on('console', (m) => {
		if (m.type() === 'error') seen.errors.push(m.text());
		if (m.type() === 'warning') seen.warnings.push(m.text());
	});
	page.on('pageerror', (e) => seen.pageErrors.push(e.message));
	page.on('response', (r) => {
		if (r.status() >= 400) seen.badResponses.push(r.status() + ' ' + r.url());
	});
	return seen;
}

export const modal = (page) => ({
	title: page.locator('#modal-title'),
	body: page.locator('#modal-body'),
	extra: page.locator('#modal-extra'),
	meta: page.locator('#modal-meta'),
	actions: page.locator('#modal-actions button'),
	root: page.locator('#tile-modal'),
});

export async function openPanel(page, id) {
	await tile(page, id).click();
	await expect(page.locator('#tile-modal')).toBeVisible();
}

export async function closePanel(page) {
	await page.keyboard.press('Escape');
	await expect(page.locator('#tile-modal')).toBeHidden();
}

// Proof that the rest of the page still works: Tasks -> "Complete one".
export async function expectTasksStillWork(page) {
	const count = tile(page, 'tasks').locator('[data-role="count"]');
	const before = Number(await count.textContent());
	await openPanel(page, 'tasks');
	await modal(page).actions.first().click();
	await expect(count).toHaveText(String(before - 1));
}

// A tile module served from the test instead of the app. Only used to inject failures.
export const fulfillModule = (body) => (route) =>
	route.fulfill({ contentType: 'text/javascript', body });
