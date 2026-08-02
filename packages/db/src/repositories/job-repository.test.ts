import { beforeEach, describe, expect, it, vi } from "vitest";
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
			select: vi.fn().mockReturnThis(),
			from: vi.fn().mockReturnThis(),
			limit: vi.fn().mockResolvedValue([]),
			set: vi.fn().mockReturnThis(),
			where: vi.fn().mockReturnThis(),
			insert: vi.fn().mockReturnThis(),
			values: vi.fn().mockReturnThis(),
			onConflictDoNothing: vi.fn().mockReturnThis(),
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

	it("does not requeue thumbnail batch parent progress records", async () => {
		await repository.requeueStaleInProgress(
			new Date("2026-06-23T00:00:00.000Z"),
		);

		const where = extractSqlText(mockExecutor.where.mock.calls[0]?.[0]);
		expect(where).toContain("thumbnail_generation_parent");
	});

	it("deduplicates active thumbnail jobs by source, media and size", async () => {
		mockExecutor.returning.mockResolvedValueOnce([]);

		const created = await repository.createIfUnique({
			type: "generate_thumbnail",
			mediaSourceId: "22222222-2222-4222-8222-222222222222",
			payload: {
				mediaId: "33333333-3333-4333-8333-333333333333",
				size: 256,
			},
		});

		expect(created).toBeNull();
		expect(mockExecutor.insert).toHaveBeenCalledOnce();
		expect(mockExecutor.onConflictDoNothing).toHaveBeenCalledOnce();
	});

	it("clears stale result and error markers when requeueing", async () => {
		await repository.requeueStaleInProgress(
			new Date("2026-06-23T00:00:00.000Z"),
		);

		expect(mockExecutor.set).toHaveBeenCalledOnce();
		expect(mockExecutor.set).toHaveBeenCalledWith({
			status: "pending",
			result: null,
			error: null,
			updatedAt: expect.any(Date),
		});
	});

	it("prevents duplicate batch progress when child result markers exist", async () => {
		mockExecutor.execute.mockResolvedValueOnce({ rows: [] });

		const progress = await repository.incrementProgress(
			"11111111-1111-4111-8111-111111111110",
			"11111111-1111-4111-8111-111111111111",
			1,
		);

		expect(progress).toBeNull();
		const query = extractSqlText(mockExecutor.execute.mock.calls[0]?.[0]);
		expect(query).toContain("parentProcessed");
		expect(query).toContain("parentFailed");
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
		expect(query).toContain("->>");
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
