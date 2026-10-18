import fs from "node:fs/promises";
import path from "node:path";
import { SourceRunRepository as repo } from "~/infrastructure/repositories/source-run-repository";
import { getJobTransferRoot, isJobTransferPath } from "./job-transfer-storage";

/** Only owned transfer paths are removed. Live/retained references outrank file age. */
export async function cleanupSourceRunFiles() {
	await repo.cleanupExpired(25, async (run) => {
		for (const target of [
			run.input?.kind === "restore" ? run.input.inputPath : null,
			run.artifact?.path,
		]) {
			if (target && isJobTransferPath(run.id, target))
				await fs.rm(target, { force: true });
		}
	});
	const root = getJobTransferRoot();
	const deadline = Date.now() - 24 * 60 * 60 * 1000;
	const idPattern =
		/^([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})(?:\.|-export-)/i;
	let removed = 0;
	for (const directoryPath of [
		path.join(root, "inputs"),
		path.join(root, "artifacts"),
		path.join(root, "staging"),
		path.resolve(root, "..", "tar-staging"),
	]) {
		const directory = await fs
			.opendir(directoryPath)
			.catch((error: unknown) => {
				if (
					error &&
					typeof error === "object" &&
					"code" in error &&
					error.code === "ENOENT"
				)
					return null;
				throw error;
			});
		if (!directory) continue;
		for await (const entry of directory) {
			if (removed >= 25) break;
			const id = idPattern.exec(entry.name)?.[1];
			if (!id || entry.isSymbolicLink()) continue;
			const target = path.join(directoryPath, entry.name),
				stat = await fs.lstat(target).catch(() => null);
			if (!stat || stat.mtimeMs > deadline) continue;
			const run = await repo.findById(id);
			// An unknown file may belong to a different DB sharing storage. Keep it for operator review.
			if (!run || run.status === "pending" || run.status === "in_progress")
				continue;
			if (
				run.input?.kind === "restore" &&
				path.resolve(run.input.inputPath) === target
			)
				continue;
			if (run.artifact && path.resolve(run.artifact.path) === target) continue;
			await fs.rm(target, { recursive: entry.isDirectory(), force: true });
			removed++;
		}
	}
}
