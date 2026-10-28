import { DurableObject } from "cloudflare:workers";

// Spring Boot listens on 8080 inside the container.
const PORT = 8080;
// Put the container to sleep after this long without requests.
const INACTIVITY_TIMEOUT_MS = 10 * 60 * 1000;
// A cold Spring Boot start on a "standard-1" instance (1/2 vCPU) can take a while.
const STARTUP_TIMEOUT_MS = 120 * 1000;

export class JellyfishApp extends DurableObject<Env> {
	private starting: Promise<void> | undefined;
	private monitoring: Promise<void> | undefined;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		const container = ctx.container;
		if (container?.running) {
			// Restore the timeout and exit monitoring after a Durable Object restart.
			void ctx.blockConcurrencyWhile(() =>
				container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS),
			);
			this.observeExit();
		}
	}

	async fetch(request: Request): Promise<Response> {
		// Share one startup across concurrent requests.
		this.starting ??= this.startAndWaitForPort().finally(() => {
			this.starting = undefined;
		});
		await this.starting;

		const url = new URL(request.url);
		url.protocol = "http:";
		url.host = "container";
		const forwarded = new Request(url, request);
		forwarded.headers.delete("host");
		return this.ctx.container!.getTcpPort(PORT).fetch(forwarded);
	}

	private async startAndWaitForPort(): Promise<void> {
		const container = this.ctx.container!;
		if (!container.running) {
			container.start({
				image: container.images.base,
				// 4 GiB, 1/2 vCPU. The only smaller type start() accepts is "lite"
				// (256 MiB), which is too small for Spring Boot.
				instance: "standard-1",
				// The page serves its CSS and JS itself, so no outbound access is needed.
				enableInternet: false,
			});
		}
		this.observeExit();
		await container.setInactivityTimeout(INACTIVITY_TIMEOUT_MS);

		// "running" means startup was requested, not that Tomcat is accepting requests.
		const port = container.getTcpPort(PORT);
		const deadline = Date.now() + STARTUP_TIMEOUT_MS;
		while (Date.now() < deadline) {
			try {
				const response = await port.fetch("http://container/", {
					signal: AbortSignal.timeout(2000),
				});
				await response.body?.cancel();
				if (response.ok) return;
			} catch {
				// Not listening yet.
			}
			await scheduler.wait(500);
		}
		throw new Error(`Container did not become ready on port ${PORT}`);
	}

	private observeExit(): void {
		if (this.monitoring) return;
		this.monitoring = this.ctx
			.container!.monitor()
			.then(() => console.log("Container exited"))
			.catch((error: unknown) => console.error("Container failed:", error))
			.finally(() => {
				this.monitoring = undefined;
			});
		this.ctx.waitUntil(this.monitoring);
	}
}

export default {
	async fetch(request, env): Promise<Response> {
		try {
			// A single instance serves every request.
			return await env.APP.getByName("main").fetch(request);
		} catch (error) {
			console.error("Container request failed:", error);
			return new Response("The app is starting or unavailable. Please retry shortly.", {
				status: 503,
				headers: { "Retry-After": "10" },
			});
		}
	},
} satisfies ExportedHandler<Env>;
