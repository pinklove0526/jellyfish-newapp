import { defineConfig, devices } from '@playwright/test';

// The app is started outside Playwright (the CI job and the README show how),
// so BASE_URL just says where it is listening.
const baseURL = process.env.BASE_URL || 'http://localhost:8080';

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
	use: {
		baseURL,
		viewport: { width: 1280, height: 1000 },
		trace: 'retain-on-failure',
		screenshot: 'only-on-failure',
	},
	projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 1000 } } }],
});
