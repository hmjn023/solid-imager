import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { RealtimeEventBus } from "~/infrastructure/events/realtime-event-bus";

const cleanups: Array<() => void> = [];

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) {
		cleanup();
	}
});

describe("RealtimeEventBus", () => {
	it("delivers a validated source event to source and wildcard subscribers", () => {
		const sourceListener = vi.fn();
		const wildcardListener = vi.fn();
		cleanups.push(
			RealtimeEventBus.subscribeToSource("source-1", sourceListener),
			RealtimeEventBus.subscribeToSource("*", wildcardListener),
		);

		RealtimeEventBus.publishSource("source-1", "media-added", {
			filePath: "images/new.png",
		});

		const expected = {
			mediaSourceId: "source-1",
			event: "media-added",
			data: { filePath: "images/new.png" },
		};
		expect(sourceListener).toHaveBeenCalledWith(expected);
		expect(wildcardListener).toHaveBeenCalledWith(expected);
	});

	it("rejects an invalid payload before publishing", () => {
		const listener = vi.fn();
		cleanups.push(RealtimeEventBus.subscribeToSource("source-1", listener));

		expect(() =>
			RealtimeEventBus.publishSource("source-1", "thumbnail-generated", {
				// The cast deliberately exercises runtime validation at the boundary.
				mediaId: "not-a-uuid",
			}),
		).toThrow();
		expect(listener).not.toHaveBeenCalled();
	});

	it("keeps source, job, and import channels isolated", () => {
		const sourceListener = vi.fn();
		const jobListener = vi.fn();
		const importListener = vi.fn();
		cleanups.push(
			RealtimeEventBus.subscribeToSource("source-1", sourceListener),
			RealtimeEventBus.subscribeToJobs(jobListener),
			RealtimeEventBus.subscribeToImports(importListener),
		);

		RealtimeEventBus.publishJob("job-progress", {
			jobId: "job-1",
			processed: 1,
			total: 2,
		});

		expect(jobListener).toHaveBeenCalledOnce();
		expect(sourceListener).not.toHaveBeenCalled();
		expect(importListener).not.toHaveBeenCalled();
	});

	it("continues delivering after a subscriber throws", () => {
		const throwingListener = vi.fn(() => {
			throw new Error("listener failed");
		});
		const healthyListener = vi.fn();
		cleanups.push(
			RealtimeEventBus.subscribeToSource("source-1", throwingListener),
			RealtimeEventBus.subscribeToSource("source-1", healthyListener),
		);

		expect(() =>
			RealtimeEventBus.publishSource("source-1", "media-added", {
				filePath: "images/new.png",
			}),
		).not.toThrow();
		expect(throwingListener).toHaveBeenCalledOnce();
		expect(healthyListener).toHaveBeenCalledOnce();
	});
});
