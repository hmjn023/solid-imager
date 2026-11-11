import { describe, expect, it, vi } from "vitest";
import type { BulkMediaOperationResult } from "@solid-imager/core/media";
import {
	createBulkActionCommand,
	executeBulkActionCommand,
	type BulkCommandOperations,
} from "./bulk-action-command";
const one = "11111111-1111-4111-8111-111111111111";
const two = "22222222-2222-4222-8222-222222222222";
const three = "33333333-3333-4333-8333-333333333333";
const success = (ids: string[]): BulkMediaOperationResult => ({
	success: true,
	items: ids.map((mediaId) => ({ mediaId, status: "succeeded" })),
});
function operations() {
	return {
		bulkCopyToSource: vi.fn(
			async (_source: string, ids: string[], _target: string) => success(ids),
		),
		bulkMoveToSource: vi.fn(
			async (_source: string, ids: string[], _target: string) => success(ids),
		),
		bulkMoveMedia: vi.fn(
			async (_source: string, ids: string[], _path: string) => success(ids),
		),
		bulkDeleteMedia: vi.fn(async () => ({})),
	} satisfies BulkCommandOperations;
}

describe("bulk media commands", () => {
	it("freezes destination/action/items across the wait between source groups", async () => {
		const ops = operations();
		const input = {
			action: "copy-source" as const,
			targetSourceId: "D",
			destinationPath: "folder",
			items: [
				{ mediaId: one, mediaSourceId: "A" },
				{ mediaId: two, mediaSourceId: "B" },
			],
		};
		const command = createBulkActionCommand(input);
		const waiting = Promise.withResolvers<BulkMediaOperationResult>();
		ops.bulkCopyToSource.mockReturnValueOnce(waiting.promise);
		const running = executeBulkActionCommand(command, ops);
		input.targetSourceId = "E";
		input.items[1].mediaId = three;
		waiting.resolve(success([one]));
		await running;
		expect(ops.bulkCopyToSource.mock.calls).toEqual([
			["A", [one], "D"],
			["B", [two], "D"],
		]);
	});
	it("retries only failed/not-processed items and keeps the initial destination", async () => {
		const ops = operations();
		const command = createBulkActionCommand({
			action: "copy-source",
			targetSourceId: "D",
			destinationPath: "",
			items: [one, two, three].map((mediaId) => ({
				mediaId,
				mediaSourceId: "A",
			})),
		});
		ops.bulkCopyToSource.mockResolvedValueOnce({
			success: false,
			items: [
				{ mediaId: one, status: "succeeded" },
				{ mediaId: two, status: "failed", error: "failed" },
				{ mediaId: three, status: "not_processed", error: "not started" },
			],
		});
		const first = await executeBulkActionCommand(command, ops);
		expect(first.succeededMediaIds).toEqual([one]);
		await executeBulkActionCommand(
			{ ...command, items: first.retryItems },
			ops,
		);
		expect(ops.bulkCopyToSource.mock.calls[1]).toEqual([
			"A",
			[two, three],
			"D",
		]);
	});
	it("does not replay ambiguous responses or unreconciled storage failures", async () => {
		const ops = operations();
		const command = createBulkActionCommand({
			action: "copy-source",
			targetSourceId: "D",
			destinationPath: "",
			items: [
				{ mediaId: one, mediaSourceId: "A" },
				{ mediaId: two, mediaSourceId: "B" },
			],
		});
		ops.bulkCopyToSource.mockRejectedValueOnce(new Error("response lost"));
		ops.bulkCopyToSource.mockResolvedValueOnce({
			success: false,
			items: [
				{
					mediaId: two,
					status: "failed",
					error: "check storage",
					retryable: false,
				},
			],
		});
		const result = await executeBulkActionCommand(command, ops);
		expect(result.retryItems).toEqual([]);
		expect(result.uncertainItems.map((item) => item.mediaId)).toEqual([
			one,
			two,
		]);
	});
});
