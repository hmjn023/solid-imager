import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Job } from "@solid-imager/core/domain/repositories/job-repository";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type JobTransferStorage =
	typeof import("~/application/services/job-transfer-storage");

let runtimeDirectory: string;
let storage: JobTransferStorage;

function createJob(overrides: Partial<Job>): Job {
	const now = new Date();
	return {
		id: randomUUID(),
		type: "source_export",
		mediaSourceId: randomUUID(),
		status: "in_progress",
		payload: { mode: "zip", includeImages: false },
		result: null,
		error: null,
		createdAt: now,
		updatedAt: now,
		parentId: null,
		attemptCount: 1,
		startedAt: now,
		finishedAt: null,
		...overrides,
	};
}

async function writeOldFile(targetPath: string): Promise<void> {
	await fs.mkdir(path.dirname(targetPath), { recursive: true });
	await fs.writeFile(targetPath, "stale transfer");
	const oldTime = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
	await fs.utimes(targetPath, oldTime, oldTime);
}

describe("job transfer storage cleanup", () => {
	beforeEach(async () => {
		runtimeDirectory = await fs.mkdtemp(
			path.join(os.tmpdir(), "solid-imager-transfer-test-"),
		);
		vi.stubEnv(
			"SOLID_IMAGER_JOB_TRANSFER_DIR",
			path.join(runtimeDirectory, "job-transfers"),
		);
		vi.resetModules();
		storage = await import("~/application/services/job-transfer-storage");
	});

	afterEach(async () => {
		vi.unstubAllEnvs();
		await fs.rm(runtimeDirectory, { recursive: true, force: true });
	});

	it("removes stale files for a known non-completed job", async () => {
		const jobId = randomUUID();
		const targetPath = storage.getArtifactPath(jobId, "zip");
		await writeOldFile(targetPath);

		const result = await storage.cleanupOrphanedJobTransferFiles(async (id) =>
			id === jobId ? createJob({ id, status: "in_progress" }) : null,
		);

		expect(result.removedFiles).toBe(1);
		expect(await fs.stat(targetPath).catch(() => null)).toBeNull();
	});

	it("keeps a valid completed artifact", async () => {
		const jobId = randomUUID();
		const targetPath = storage.getArtifactPath(jobId, "zip");
		await writeOldFile(targetPath);
		const job = createJob({
			id: jobId,
			status: "completed",
			artifactPath: targetPath,
			finishedAt: new Date(),
		});

		const result = await storage.cleanupOrphanedJobTransferFiles(
			async () => job,
		);

		expect(result.removedFiles).toBe(0);
		expect((await fs.stat(targetPath)).isFile()).toBe(true);
	});

	it("keeps a file whose job is unknown until TTL expiry", async () => {
		const jobId = randomUUID();
		const targetPath = storage.getArtifactPath(jobId, "zip");
		await writeOldFile(targetPath);

		const result = await storage.cleanupOrphanedJobTransferFiles(
			async () => null,
		);

		expect(result.removedFiles).toBe(0);
		expect((await fs.stat(targetPath)).isFile()).toBe(true);
	});

	it("removes stale partial output without a database lookup", async () => {
		const jobId = randomUUID();
		const targetPath = storage.getArtifactPartialPath(jobId, "zip");
		await writeOldFile(targetPath);
		const findJob = vi.fn(async () => null);

		const result = await storage.cleanupOrphanedJobTransferFiles(findJob);

		expect(result.removedFiles).toBe(1);
		expect(findJob).not.toHaveBeenCalled();
		expect(await fs.stat(targetPath).catch(() => null)).toBeNull();
	});
});
