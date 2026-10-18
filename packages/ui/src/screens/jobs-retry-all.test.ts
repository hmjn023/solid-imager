import { describe, expect, it, vi } from "vitest";
import type { JobRetryFailedResponse } from "@solid-imager/core/domain/jobs/schemas";
import { retryAllFailedJobs } from "./jobs-retry-all";

const before = "2026-01-01T00:00:00.000000";
const cursor = (index: number) => ({
	before,
	afterId: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
});
describe("all failed jobs continuation", () => {
	it("processes more than one UI page without collecting all IDs or issuing concurrent retries", async () => {
		let calls = 0;
		const retry = vi.fn(async (): Promise<JobRetryFailedResponse> => ({
			retried: 5,
			skipped: 0,
			failed: 0,
			cursor: ++calls < 50 ? cursor(calls) : null,
		}));
		const progress = vi.fn();
		expect(
			await retryAllFailedJobs(retry, new AbortController().signal, progress),
		).toEqual({ retried: 250, skipped: 0, failed: 0 });
		expect(retry).toHaveBeenCalledTimes(50);
		expect(progress).toHaveBeenLastCalledWith({
			retried: 250,
			skipped: 0,
			failed: 0,
		});
	});
	it("retains committed progress when the next request fails", async () => {
		const retry = vi
			.fn()
			.mockResolvedValueOnce({
				retried: 5,
				skipped: 1,
				failed: 1,
				cursor: cursor(1),
			})
			.mockRejectedValueOnce(new Error("offline"));
		const progress = vi.fn();
		await expect(
			retryAllFailedJobs(retry, new AbortController().signal, progress),
		).rejects.toThrow("offline");
		expect(progress).toHaveBeenLastCalledWith({
			retried: 5,
			skipped: 1,
			failed: 1,
		});
	});
	it("stops continuation when the view is disposed", async () => {
		const controller = new AbortController();
		const retry = vi.fn(async () => {
			controller.abort();
			return { retried: 5, skipped: 0, failed: 0, cursor: cursor(1) };
		});
		await expect(
			retryAllFailedJobs(retry, controller.signal, vi.fn()),
		).rejects.toMatchObject({ name: "AbortError" });
		expect(retry).toHaveBeenCalledTimes(1);
	});
	it("rejects a stuck cursor instead of endlessly retrying the same page", async () => {
		const retry = vi.fn().mockResolvedValue({
			retried: 0,
			skipped: 0,
			failed: 1,
			cursor: cursor(1),
		});
		await expect(
			retryAllFailedJobs(retry, new AbortController().signal, vi.fn()),
		).rejects.toThrow("続き位置");
		expect(retry).toHaveBeenCalledTimes(2);
	});
});
