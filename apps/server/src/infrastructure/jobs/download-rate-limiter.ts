import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";

type DownloadRateLimitConfig = AppConfig["downloads"];

let config: DownloadRateLimitConfig = {
	rateLimitEnabled: true,
	requestIntervalMs: 1_000,
};
let lastRequestTime = 0;
let pendingChain: Promise<void> = Promise.resolve();

export function updateDownloadRateLimitConfig(
	newConfig: DownloadRateLimitConfig,
): void {
	config = newConfig;
}

export async function waitForDownloadRateLimit(): Promise<void> {
	if (!config.rateLimitEnabled || config.requestIntervalMs <= 0) {
		return;
	}

	const previous = pendingChain;
	pendingChain = (async () => {
		await previous;
		const elapsed = Date.now() - lastRequestTime;
		const delay = config.requestIntervalMs - elapsed;
		if (delay > 0) {
			await new Promise<void>((resolve) => setTimeout(resolve, delay));
		}
		lastRequestTime = Date.now();
	})();

	await pendingChain;
}
