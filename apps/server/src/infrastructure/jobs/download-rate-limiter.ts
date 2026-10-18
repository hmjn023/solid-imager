import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { abortableDelay } from "@solid-imager/core/utils/abortable-delay";

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

export async function waitForDownloadRateLimit(
	signal?: AbortSignal,
): Promise<void> {
	signal?.throwIfAborted();
	if (!config.rateLimitEnabled || config.requestIntervalMs <= 0) {
		return;
	}

	const previous = pendingChain;
	pendingChain = (async () => {
		try {
			await previous;
		} catch {
			// 前のチェーンのエラーでレートリミッターが機能停止しないよう無視
		}
		signal?.throwIfAborted();
		const elapsed = Date.now() - lastRequestTime;
		const waitMs = config.requestIntervalMs - elapsed;
		if (waitMs > 0) {
			await abortableDelay(waitMs, signal);
		}
		lastRequestTime = Date.now();
	})();

	await pendingChain;
}
