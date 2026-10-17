import { afterEach, describe, expect, it, vi } from "vitest";
import {
	AiMediaTaskService,
	type AiMediaTaskDeps,
} from "@solid-imager/application/services/ai-media-task-service";
import type { MediaProcessingInput } from "@solid-imager/core/domain/processing/schemas";

function fixture() {
	const input: MediaProcessingInput = {
		mediaId: "22222222-2222-4222-8222-222222222222",
		mediaSourceId: "11111111-1111-4111-8111-111111111111",
		mediaType: "image",
		sourcePath: "/fixture",
		filePath: "image.png",
		fileSize: 100,
		modifiedAt: new Date("2026-01-01"),
	};
	const state = {
		requestId: "33333333-3333-4333-8333-333333333333",
		requestedRevision: "v1",
		taskKind: "tagging",
		status: "pending",
	};
	const deps: AiMediaTaskDeps = {
		transactionManager: { transaction: (action) => action({}) },
		mediaRepo: {
			findById: vi.fn().mockResolvedValue({
				id: input.mediaId,
				...input,
			}),
		} as any,
		sourceRepo: {
			findById: vi.fn().mockResolvedValue({
				type: "local",
				connectionInfo: { path: input.sourcePath },
			}),
		} as any,
		processingStateRepo: {
			request: vi.fn().mockResolvedValue(state),
			findByMediaIds: vi.fn().mockImplementation(async () => [state]),
		} as any,
	};
	const infer = vi.fn().mockResolvedValue("result");
	const service = new AiMediaTaskService(deps, "tagging", {
		currentRevision: () => "v1",
		canReuse: () => true,
		infer,
		load: async () => "result",
		save: async () => {},
	});
	return { service, input, state, infer, deps };
}

describe("durable AI observation timeout", () => {
	afterEach(() => vi.useRealTimers());
	it("observes successful work that completes 137 seconds after submission", async () => {
		vi.useFakeTimers();
		const { service, input, state, infer } = fixture();
		const completed = expect(service.execute(input)).resolves.toEqual({
			response: "result",
			reused: false,
		});
		setTimeout(() => {
			state.status = "completed";
		}, 137_000);
		await vi.advanceTimersByTimeAsync(137_250);
		await completed;
		expect(infer).not.toHaveBeenCalled();
	});
	it("retains queued work when the three-minute observation budget expires", async () => {
		vi.useFakeTimers();
		const { service, input, state, deps } = fixture();
		const pending = expect(service.execute(input)).rejects.toThrow(
			"request remains queued",
		);
		await vi.advanceTimersByTimeAsync(180_250);
		await pending;
		expect(state.status).toBe("pending");
		expect(deps.processingStateRepo.request).toHaveBeenCalledOnce();
	});
});
