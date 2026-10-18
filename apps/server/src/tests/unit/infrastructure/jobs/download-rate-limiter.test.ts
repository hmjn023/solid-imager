import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	updateDownloadRateLimitConfig,
	waitForDownloadRateLimit,
} from "~/infrastructure/jobs/download-rate-limiter";

describe("download-rate-limiter", () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.setSystemTime(new Date("2026-04-01T00:00:00.000Z"));
		updateDownloadRateLimitConfig({
			rateLimitEnabled: true,
			requestIntervalMs: 1_000,
		});
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	it("should not wait when rate limiting is disabled", async () => {
		updateDownloadRateLimitConfig({
			rateLimitEnabled: false,
			requestIntervalMs: 1_000,
		});

		await expect(waitForDownloadRateLimit()).resolves.toBeUndefined();
	});

	it("should serialize requests using the configured interval", async () => {
		const first = waitForDownloadRateLimit();
		await vi.runAllTimersAsync();
		await first;

		const second = waitForDownloadRateLimit();
		await vi.advanceTimersByTimeAsync(999);
		let settled = false;
		void second.then(() => {
			settled = true;
		});
		await Promise.resolve();
		expect(settled).toBe(false);

		await vi.advanceTimersByTimeAsync(1);
		await second;
		expect(settled).toBe(true);
	});
	it("aborts queued downloads without leaving a timer or blocking the next request", async () => {
		const initial = waitForDownloadRateLimit();
		await vi.runAllTimersAsync();
		await initial;
		const first = new AbortController();
		const second = new AbortController();
		const waiting = waitForDownloadRateLimit(first.signal);
		const queued = waitForDownloadRateLimit(second.signal);
		await vi.advanceTimersByTimeAsync(0);
		const a = expect(waiting).rejects.toBeInstanceOf(DOMException);
		const b = expect(queued).rejects.toBeInstanceOf(DOMException);
		first.abort();
		second.abort();
		await Promise.all([a, b]);
		expect(vi.getTimerCount()).toBe(0);
		const next = waitForDownloadRateLimit();
		await vi.advanceTimersByTimeAsync(1000);
		await next;
	});
});
