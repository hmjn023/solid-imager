import type {
	ImportSourceZipInput,
	ImportSourceZipResult,
} from "@solid-imager/application/services/backup-orchestration";
import { enqueueThumbnailJobsAfterRestore } from "@solid-imager/application/services/backup-restore-complete";
import { createBackupService } from "@solid-imager/db/backup";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";
import { joinLocalPath } from "../../path-utils";
import { TauriSourceRepository } from "../repositories/source-repository";
import { TauriJobRepository } from "../repositories/tauri-job-repository";
import { TauriSourceService } from "./source-service";

type BinaryFilePayload = {
	fileName: string;
	mimeType: string;
	data: number[];
};

type RestoreSourceResult = {
	processed: number;
	skipped: number;
	errors: string[];
};

function toLocalSourcePath(
	source: Awaited<ReturnType<typeof TauriSourceRepository.findById>>,
) {
	if (!source) {
		throw new Error("Media source not found");
	}
	if (source.type !== "local" || !("path" in source.connectionInfo)) {
		throw new Error("Tauri currently supports only local sources.");
	}
	return source.connectionInfo.path;
}

function getExecutor(tx?: unknown): TauriDbExecutor {
	return (tx ?? getTauriAppServices().db) as TauriDbExecutor;
}

async function pathExists(fullPath: string) {
	try {
		await getTauriAppServices().fileSystem.stat(fullPath);
		return true;
	} catch {
		return false;
	}
}

const backupService = createBackupService({
	getExecutor,
	sourceRepository: TauriSourceRepository,
	resolvePath: joinLocalPath,
	pathExists,
	runTransaction: async <T>(
		callback: (executor: TauriDbExecutor) => Promise<T>,
	) => {
		return await getTauriAppServices().db.transaction(
			async (tx) => await callback(tx as TauriDbExecutor),
		);
	},
	onRestoreComplete: async ({ source, mediaIds, rootPath }) => {
		await enqueueThumbnailJobsAfterRestore(
			{ source, mediaIds, rootPath },
			{ jobRepository: TauriJobRepository },
		);
	},
});

export const TauriSourceBackupService = {
	findMediaSourceForFile: backupService.findMediaSourceForFile,

	async createDump(
		mediaSourceId: string,
		mode: "json" | "zip" = "json",
	): Promise<unknown[] | BinaryFilePayload> {
		const items = await backupService.createDumpItems(mediaSourceId);
		if (mode === "json") {
			return items;
		}

		const source = await TauriSourceRepository.findById(mediaSourceId);
		const rootPath = toLocalSourcePath(source);
		return await getTauriAppServices().commandClient.invoke<BinaryFilePayload>(
			"backup_create_zip",
			{
				rootPath,
				dumpJson: JSON.stringify(items, null, 2),
				filePaths: items
					.map((item) => item.filePath)
					.filter((filePath): filePath is string => Boolean(filePath)),
				fileName: `source-${mediaSourceId}-dump.zip`,
			},
		);
	},

	async restoreSource(
		mediaSourceId: string,
		items: unknown[],
	): Promise<RestoreSourceResult> {
		return await backupService.restoreSource(mediaSourceId, items);
	},

	async importSourceZip(
		mediaSourceId: string,
		input: ImportSourceZipInput,
	): Promise<ImportSourceZipResult> {
		if (input.type !== "bytes") {
			throw new Error("Tauri only supports bytes-based zip import");
		}
		const bytes = input.bytes;

		const source = await TauriSourceRepository.findById(mediaSourceId);
		const rootPath = toLocalSourcePath(source);
		const dumpData = await getTauriAppServices().commandClient.invoke<
			unknown[]
		>("backup_extract_zip", {
			rootPath,
			bytes,
		});

		await TauriSourceService.sync([mediaSourceId]);
		const restoreResult = await backupService.restoreSource(
			mediaSourceId,
			dumpData,
		);

		return {
			success: true,
			importedCount: restoreResult.processed,
			skippedCount: restoreResult.skipped,
			errors: restoreResult.errors,
			message: `Successfully imported ${restoreResult.processed} items (Skipped: ${restoreResult.skipped})`,
		};
	},
};
