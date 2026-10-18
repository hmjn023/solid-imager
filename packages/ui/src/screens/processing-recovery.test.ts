import { describe, expect, it, vi } from "vitest";
import {
	emptyRecoveryProgress,
	runProcessingRecovery,
} from "./processing-recovery";
import type { ProcessingRecoveryResponse } from "@solid-imager/core/domain/processing/schemas";

const before = "2026-10-18T00:00:00.000000";
const id = (index: number) =>
	`00000000-0000-4000-8000-${String(index).padStart(12, "0")}`;
const page = (
	index: number,
	count: number,
	more: boolean,
): ProcessingRecoveryResponse => ({
	scanned: count,
	queued: count,
	jobId: id(index),
	items: Array.from({ length: count }, (_, item) => ({
		mediaId: id(index * 100 + item),
		fileName: "fixture.png",
		sourceName: "Fixture",
		reason: "not_requested",
	})),
	cursor: more ? { before, afterId: id(index * 100) } : null,
});
describe("processing recovery continuation", () => {
	it("queues more than 200 targets without retaining all IDs", async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(page(1, 100, true))
			.mockResolvedValueOnce(page(2, 100, true))
			.mockResolvedValueOnce(page(3, 51, false));
		const progress = vi.fn();
		const result = await runProcessingRecovery(
			request,
			{ kind: "metadata" },
			new AbortController().signal,
			progress,
		);
		expect(result).toMatchObject({
			scanned: 251,
			matched: 251,
			queued: 251,
			batches: 3,
		});
		expect(result.samples).toHaveLength(10);
		expect(result.reasons.not_requested).toBe(251);
		expect(request.mock.calls[1][0].cursor).toEqual(page(1, 100, true).cursor);
	});
	it("retains committed progress on a later connection failure", async () => {
		const request = vi
			.fn()
			.mockResolvedValueOnce(page(1, 100, true))
			.mockRejectedValueOnce(new Error("offline"));
		let progress = emptyRecoveryProgress();
		await expect(
			runProcessingRecovery(
				request,
				{ kind: "thumbnail" },
				new AbortController().signal,
				(value) => {
					progress = value;
				},
			),
		).rejects.toThrow("offline");
		expect(progress.queued).toBe(100);
	});
	it("continues empty pages, stops after abort, and rejects a stuck cursor", async () => {
		const controller = new AbortController();
		const request = vi.fn().mockResolvedValue(page(1, 0, true));
		await expect(
			runProcessingRecovery(
				request,
				{ kind: "metadata" },
				controller.signal,
				() => controller.abort(),
			),
		).rejects.toMatchObject({ name: "AbortError" });
		expect(request).toHaveBeenCalledOnce();
		const repeating = vi.fn().mockResolvedValue(page(1, 0, true));
		await expect(
			runProcessingRecovery(
				repeating,
				{ kind: "metadata" },
				new AbortController().signal,
				() => {},
			),
		).rejects.toThrow("cursor did not advance");
		expect(repeating).toHaveBeenCalledTimes(2);
	});
});
