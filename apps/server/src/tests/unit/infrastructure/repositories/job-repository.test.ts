import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { db } from "~/infrastructure/db";
import { JobRepository } from "~/infrastructure/repositories/job-repository";

describe("JobRepository", () => {
	const repository = new JobRepository();

	beforeEach(() => {
		(db as { execute?: unknown }).execute = vi.fn().mockResolvedValue({
			rows: [
				{
					id: "11111111-1111-4111-8111-111111111111",
					type: "processMedia",
					mediaSourceId: null,
					status: "in_progress",
					payload: { mediaId: "media-1" },
					result: null,
					error: null,
					createdAt: "2026-06-23T00:00:00.000Z",
					updatedAt: "2026-06-23T00:00:01.000Z",
					parentId: null,
				},
			],
		});
	});

	it("claims pending jobs and maps returned rows", async () => {
		const claimed = await repository.claimPending(1, {
			excludeTypes: ["auto_tagging"],
		});

		expect(claimed).toEqual([
			expect.objectContaining({
				id: "11111111-1111-4111-8111-111111111111",
				type: "processMedia",
				status: "in_progress",
				createdAt: new Date("2026-06-23T00:00:00.000Z"),
				updatedAt: new Date("2026-06-23T00:00:01.000Z"),
			}),
		]);
		expect(db.execute).toHaveBeenCalledOnce();
	});

	it("rejects conflicting pending filters", async () => {
		await expect(
			repository.claimPending(1, {
				includeTypes: ["auto_tagging"],
				excludeTypes: ["processMedia"],
			}),
		).rejects.toThrow(
			"Cannot use excludeTypes and includeTypes simultaneously.",
		);
	});

	it("returns the number of stale jobs requeued", async () => {
		const count = await repository.requeueStaleInProgress(
			new Date("2026-06-23T00:00:00.000Z"),
		);

		expect(count).toBe(1);
	});
});
