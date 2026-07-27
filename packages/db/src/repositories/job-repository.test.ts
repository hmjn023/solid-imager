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
						queueName: "default",
						targetId: "media-1",
						inputRevision: "revision-1",
						dedupeKey: "processMedia:media-1:revision-1:normal",
						concurrencyKey: "media:media-1:processMedia",
						availableAt: "2026-06-23T00:00:00.000Z",
						attemptCount: 1,
						maxAttempts: 5,
						leaseDurationMs: 300000,
						claimToken: "22222222-2222-4222-8222-222222222222",
						claimedBy: "test-worker",
						claimedAt: "2026-06-23T00:00:01.000Z",
						heartbeatAt: "2026-06-23T00:00:01.000Z",
						errorCode: null,
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
			queueNames: ["ai"],
			workerId: "test-worker",
			now: new Date("2026-06-23T00:00:01.000Z"),
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
		expect(query).toContain("ranked_jobs");
		expect(query).toContain("PARTITION BY COALESCE(candidate.concurrency_key");
		expect(query).toContain("active.status = 'in_progress'");
		expect(query).toContain("candidate.queue_name");
		expect(query).toContain("candidate.queue_name IS NULL");
		expect(query).toContain("claim_token = gen_random_uuid()");
		expect(query).toContain("FOR UPDATE OF jobs SKIP LOCKED");
	});

	it("serializes LanceDB jobs per media source", async () => {
		await repository.claimPending(2, {
			includeTypes: ["sync_lancedb_delta"],
		});

		const query = extractSqlText(mockExecutor.execute.mock.calls[0]?.[0]);
		expect(query).toContain("ranked_jobs");
		expect(query).toContain("candidate.concurrency_key");
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

	it("uses claim-token and input-revision fences for heartbeats", async () => {
		const accepted = await repository.heartbeatClaim(
			"11111111-1111-4111-8111-111111111111",
			{
				claimToken: "22222222-2222-4222-8222-222222222222",
				inputRevision: "revision-1",
			},
		);

		expect(accepted).toBe(true);
		expect(mockExecutor.update).toHaveBeenCalledOnce();
	});

	it("retries a fenced failure without overwriting the claim", async () => {
		mockExecutor.execute.mockResolvedValueOnce({
			rows: [{ status: "pending", attemptCount: 2 }],
		});
		const failure = await repository.failClaim(
			"11111111-1111-4111-8111-111111111111",
			{
				claimToken: "22222222-2222-4222-8222-222222222222",
				inputRevision: "revision-1",
			},
			{
				error: "temporary",
				errorCode: "JOB_EXECUTION_FAILED",
				retryable: true,
				retryAt: new Date("2026-06-23T00:01:00.000Z"),
			},
		);

		expect(failure).toEqual({ status: "pending", attemptCount: 2 });
		const query = extractSqlText(mockExecutor.execute.mock.calls[0]?.[0]);
		expect(query).toContain("claim_token");
		expect(query).toContain("input_revision");
		expect(query).toContain("IS NOT DISTINCT FROM");
	});

	it("keeps terminal batch parents immutable while recomputing progress", async () => {
		mockExecutor.execute.mockResolvedValueOnce({
			rows: [
				{
					payload: { processed: 1, failed: 0, total: 1 },
					status: "failed",
					previousStatus: "failed",
				},
			],
		});

		const progress = await repository.recomputeBatchProgress(
			"11111111-1111-4111-8111-111111111111",
		);

		expect(progress).toEqual({
			processed: 1,
			failed: 0,
			total: 1,
			status: "failed",
			transitioned: false,
		});
		const query = extractSqlText(mockExecutor.execute.mock.calls[0]?.[0]);
		expect(query).toContain("= 'in_progress'");
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
		expect(query).toContain("COALESCE");
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
