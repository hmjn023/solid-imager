import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import { emit } from "@tauri-apps/api/event";
import { getTauriAppServices } from "~/app-services";
import {
	dirname,
	extname,
	joinLocalPath,
	splitStemAndExt,
} from "../path-utils";
import { fetchMediaSource, syncMediaSources } from "./sources-api";

type PendingImportJob = {
	id: string;
	item: DownloadItem;
	createdAt: string;
	targetSourceId?: string;
};

const IMPORT_QUEUE_KEY = "solid-imager.pending-imports";

function readQueue(): PendingImportJob[] {
	if (typeof localStorage === "undefined") {
		return [];
	}
	try {
		const raw = localStorage.getItem(IMPORT_QUEUE_KEY);
		return raw ? (JSON.parse(raw) as PendingImportJob[]) : [];
	} catch {
		return [];
	}
}

function writeQueue(queue: PendingImportJob[]) {
	if (typeof localStorage === "undefined") {
		return;
	}
	localStorage.setItem(IMPORT_QUEUE_KEY, JSON.stringify(queue));
}

async function emitImportEvent(
	event: string,
	payload: Record<string, unknown>,
) {
	await emit(event, payload);
}

function resolveDownloadTarget(item: DownloadItem) {
	if (item.targetUrl) {
		return item.targetUrl;
	}
	return item.sourceUrls?.[0];
}

function createPendingJob(
	item: DownloadItem,
	targetSourceId?: string,
): PendingImportJob {
	return {
		id: crypto.randomUUID(),
		item,
		createdAt: new Date().toISOString(),
		targetSourceId,
	};
}

async function downloadItemToSource(
	targetSourceId: string,
	item: DownloadItem,
) {
	const downloadTarget = resolveDownloadTarget(item);
	if (!downloadTarget) {
		throw new Error("targetUrl or sourceUrls[0] is required");
	}
	const source = await fetchMediaSource(targetSourceId);
	if (source.type !== "local") {
		throw new Error("Only local sources are supported in Tauri.");
	}
	const response = await fetch(downloadTarget);
	if (!response.ok) {
		throw new Error(`Failed to download ${downloadTarget}: ${response.status}`);
	}
	const bytes = new Uint8Array(await response.arrayBuffer());
	const targetRoot = (source.connectionInfo as { path?: string }).path;
	if (!targetRoot) {
		throw new Error("Source path is missing.");
	}

	const sourceFileName =
		item.fileName ||
		basenameFromUrl(downloadTarget) ||
		`${crypto.randomUUID()}${guessExtension(response)}`;
	const targetPath = await resolveUniqueTargetPath(targetRoot, sourceFileName);
	await getTauriAppServices().fileSystem.mkdir(dirname(targetPath), {
		recursive: true,
	});
	await getTauriAppServices().fileSystem.writeFile(targetPath, bytes);
}

function basenameFromUrl(url: string) {
	try {
		const parsed = new URL(url);
		const fileName = parsed.pathname.split("/").pop();
		return fileName || undefined;
	} catch {
		return undefined;
	}
}

function guessExtension(response: Response) {
	const contentType = response.headers.get("content-type") || "";
	if (contentType.includes("png")) return ".png";
	if (contentType.includes("jpeg")) return ".jpg";
	if (contentType.includes("webp")) return ".webp";
	if (contentType.includes("gif")) return ".gif";
	return extname(new URL(response.url).pathname) || "";
}

async function resolveUniqueTargetPath(rootPath: string, fileName: string) {
	const fs = getTauriAppServices().fileSystem;
	const { stem, extension } = splitStemAndExt(fileName);
	let index = 0;
	while (true) {
		const candidateName =
			index === 0 ? `${stem}${extension}` : `${stem}-${index}${extension}`;
		const candidatePath = joinLocalPath(rootPath, candidateName);
		if (!(await fs.exists(candidatePath))) {
			return candidatePath;
		}
		index += 1;
	}
}

export async function processImportItemsToSource(
	targetSourceId: string,
	items: DownloadItem[],
) {
	for (const item of items) {
		await downloadItemToSource(targetSourceId, item);
	}
	await syncMediaSources([targetSourceId]);
	return { success: true, processedCount: items.length };
}

export async function bulkAddImportItems(
	items: DownloadItem[],
	targetSourceId?: string,
) {
	const queue = [
		...readQueue(),
		...items.map((item) => createPendingJob(item, targetSourceId)),
	];
	writeQueue(queue);
	await emitImportEvent("import-request:created", { count: items.length });
	return { addedCount: items.length, skippedCount: 0, restoredCount: 0 };
}

export async function listPendingImports() {
	return readQueue();
}

export async function processPendingImports(
	jobIds: string[],
	targetSourceId?: string,
) {
	const queue = readQueue();
	const selectedJobs = queue.filter((job) => jobIds.includes(job.id));
	const itemsByTargetSource = new Map<string, DownloadItem[]>();
	for (const job of selectedJobs) {
		const resolvedTargetSourceId = targetSourceId || job.targetSourceId;
		if (!resolvedTargetSourceId) {
			throw new Error("Target source is required");
		}
		const existingItems = itemsByTargetSource.get(resolvedTargetSourceId) || [];
		existingItems.push(job.item);
		itemsByTargetSource.set(resolvedTargetSourceId, existingItems);
	}
	for (const [resolvedTargetSourceId, items] of itemsByTargetSource) {
		await processImportItemsToSource(resolvedTargetSourceId, items);
	}
	const remaining = queue.filter((job) => !jobIds.includes(job.id));
	writeQueue(remaining);
	await emitImportEvent("import-request:processed", {
		processedCount: selectedJobs.length,
	});
	return { success: true, processedCount: selectedJobs.length };
}

export async function cancelPendingImports(jobIds: string[]) {
	const remaining = readQueue().filter((job) => !jobIds.includes(job.id));
	writeQueue(remaining);
	await emitImportEvent("import-request:deleted", { jobIds });
	return { success: true };
}
