import { defineConfig, devices } from '@playwright/test';

import { BASE_URL as baseURL, MODE, STATIC_PORT, STATIC_SUBPATH } from './tests/mode.js';

// live: the app is started outside Playwright (the CI job and the README show
// how), so BASE_URL just says where it is listening.
// static: Playwright starts a plain file server for ../site under the sub-path.

export default defineConfig({
	testDir: './tests',
	timeout: 30_000,
	expect: { timeout: 10_000 },
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// No retries: a failing check should fail, not be hidden by a second try.
	retries: 0,
	workers: process.env.CI ? 2 : undefined,
	reporter: process.env.CI
		? [['list'], ['github'], ['html', { open: 'never' }]]
		: [['list'], ['html', { open: 'never' }]],
	webServer:
		MODE === 'static'
			? {
					command: `node static-server.js ${process.env.SITE_DIR || '../site'} ${STATIC_SUBPATH} ${STATIC_PORT}`,
					url: baseURL,
					reuseExistingServer: false,
				}
			: undefined,
	use: {
		baseURL,
		viewport: { width: 1280, height: 1000 },
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 } } }],
});
