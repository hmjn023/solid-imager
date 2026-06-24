import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { createJobRepository } from "./job-repository";
import type { DrizzleExecutor } from "../types";

describe("JobRepository", () => {
	let mockExecutor: any;
	let repository: any;

	beforeEach(() => {
		mockExecutor = {
			execute: vi.fn().mockResolvedValue({
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
			}),
			update: vi.fn().mockReturnThis(),
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			returning: vi.fn().mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111" }]),
		};

		repository = createJobRepository(() => mockExecutor as DrizzleExecutor);
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
		expect(mockExecutor.execute).toHaveBeenCalledOnce();
		const query = extractSqlText(mockExecutor.execute.mock.calls[0]?.[0]);
		expect(query).toContain("ROW_NUMBER() OVER");
		expect(query).toContain("ELSE id");
		expect(query).toContain("active.status = 'in_progress'");
		expect(query).toContain("FOR UPDATE OF jobs SKIP LOCKED");
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
		expect(mockExecutor.update).toHaveBeenCalledOnce();
	});
});

function extractSqlText(value: unknown): string {
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map(extractSqlText).join("");
	}
	if (value && typeof value === "object") {
		return Object.values(value).map(extractSqlText).join("");
	}
	return "";
}
