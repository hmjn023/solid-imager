import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { DrizzleExecutor } from "../types";
import { createJobRepository } from "./job-repository";

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
						payload: '{"mediaId":"media-1","sourcePath":"/media"}',
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
			returning: vi
				.fn()
				.mockResolvedValue([{ id: "11111111-1111-4111-8111-111111111111" }]),
		};

		repository = createJobRepository(() => mockExecutor as DrizzleExecutor);
	});

	it("claims non-LanceDB jobs without source serialization", async () => {
		const claimed = await repository.claimPending(1, {
			includeTypes: ["auto_tagging"],
		});

		expect(claimed).toEqual([
			expect.objectContaining({
				id: "11111111-1111-4111-8111-111111111111",
				type: "processMedia",
				status: "in_progress",
				payload: { mediaId: "media-1", sourcePath: "/media" },
				createdAt: new Date("2026-06-23T00:00:00.000Z"),
				updatedAt: new Date("2026-06-23T00:00:01.000Z"),
			}),
		]);
		expect(mockExecutor.execute).toHaveBeenCalledOnce();
		const query = extractSqlText(mockExecutor.execute.mock.calls[0]?.[0]);
		expect(query).not.toContain("eligible_jobs");
		expect(query).not.toContain("DISTINCT ON");
		expect(query).not.toContain("active.status = 'in_progress'");
		expect(query).toContain("FOR UPDATE SKIP LOCKED");
	});

	it("serializes LanceDB jobs per media source", async () => {
		await repository.claimPending(2, {
			includeTypes: ["sync_lancedb_delta"],
		});

		const query = extractSqlText(mockExecutor.execute.mock.calls[0]?.[0]);
		expect(query).toContain("eligible_jobs");
		expect(query).toContain("DISTINCT ON (source_id)");
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

	it("casts dynamic batch result marker keys to PostgreSQL text", async () => {
		mockExecutor.execute.mockResolvedValueOnce({
			rows: [{ payload: { processed: 25, failed: 0, total: 100 } }],
		});

		const progress = await repository.incrementProgress(
			"11111111-1111-4111-8111-111111111110",
			"11111111-1111-4111-8111-111111111111",
			25,
		);

		expect(progress).toEqual({ processed: 25, failed: 0, total: 100 });
		const query = extractSqlText(mockExecutor.execute.mock.calls[0]?.[0]);
		expect(query).toContain("jsonb_build_object(");
		expect(query).toContain("::text, true)");
		expect(query).toContain("->>(");
		expect(query).toContain("::text)");
	});
});

function extractSqlText(value: unknown, seen = new WeakSet<object>()): string {
	if (typeof value === "string") {
		return value;
	}
	if (Array.isArray(value)) {
		return value.map((item) => extractSqlText(item, seen)).join("");
	}
	if (value && typeof value === "object") {
		if (seen.has(value)) {
			return "";
		}
		seen.add(value);
		return Object.values(value)
			.map((item) => extractSqlText(item, seen))
			.join("");
	}
	return "";
}
