import type {
	MediaSource,
	NewMediaSource,
} from "@solid-imager/core/domain/repositories/source-repository";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { getTauriAppServices } from "~/app-services";
import { basename, extname, joinLocalPath } from "../../path-utils";
import { TauriMediaRepository } from "../repositories/media-repository";
import { TauriSourceRepository } from "../repositories/source-repository";
import { TauriConfigService } from "./config-service";

type ProbeMediaResult = {
	width: number;
	height: number;
	size: number;
	created_at: string;
	modified_at: string;
	duration?: number | null;
	mime_type?: string | null;
	codec?: string | null;
};

type SyncResult = {
	id: string;
	success: boolean;
	added: number;
	deleted: number;
	error?: string;
};

function toSafeMediaSource(source: MediaSource): SafeMediaSource {
	if (source.type === "sftp") {
		const info = source.connectionInfo as {
			host: string;
			port: number;
			username: string;
			remotePath: string;
		};
		return {
			...source,
			connectionInfo: {
				host: info.host,
				port: info.port,
				username: info.username,
				remotePath: info.remotePath,
			},
		};
	}

	if (source.type === "s3") {
		const info = source.connectionInfo as {
			bucket: string;
			region: string;
			prefix?: string;
		};
		return {
			...source,
			connectionInfo: {
				bucket: info.bucket,
				region: info.region,
				prefix: info.prefix,
			},
		};
	}

	return source as SafeMediaSource;
}

function inferMediaType(
	filePath: string,
	supportedExtensions: {
		image: string[];
		video: string[];
		audio: string[];
	},
): "image" | "video" | "audio" | null {
	const normalizedExt = extname(filePath).toLowerCase();
	if (supportedExtensions.image.includes(normalizedExt)) return "image";
	if (supportedExtensions.video.includes(normalizedExt)) return "video";
	if (supportedExtensions.audio.includes(normalizedExt)) return "audio";
	return null;
}

function normalizeRelativePath(path: string) {
	return path.replace(/[\\/]+/g, "/");
}

async function scanDirectoryRecursive(rootPath: string): Promise<string[]> {
	const fs = getTauriAppServices().fileSystem;
	const entries = await fs.readdir(rootPath);
	const files: string[] = [];

	for (const entry of entries) {
		if (entry.startsWith(".")) {
			continue;
		}
		const fullPath = joinLocalPath(rootPath, entry);
		const stat = await fs.stat(fullPath);
		if (stat.isDirectory) {
			files.push(...(await scanDirectoryRecursive(fullPath)));
			continue;
		}
		files.push(fullPath);
	}

	return files;
}

function toRelativePath(rootPath: string, fullPath: string) {
	const normalizedRoot = rootPath.replace(/[\\/]+$/, "");
	const rootWithSep = `${normalizedRoot}${normalizedRoot.includes("\\") ? "\\" : "/"}`;
	if (fullPath.startsWith(rootWithSep)) {
		return normalizeRelativePath(fullPath.slice(rootWithSep.length));
	}
	if (fullPath === normalizedRoot) {
		return "";
	}
	return normalizeRelativePath(
		fullPath.replace(normalizedRoot, "").replace(/^[\\/]+/, ""),
	);
}

async function upsertSourceFile(
	sourceId: string,
	rootPath: string,
	fullPath: string,
	mediaType: "image" | "video" | "audio",
) {
	const relativePath = toRelativePath(rootPath, fullPath);
	const existing = await TauriMediaRepository.findByPath(
		sourceId,
		relativePath,
	);
	const probe =
		await getTauriAppServices().commandClient.invoke<ProbeMediaResult>(
			"probe_media",
			{ mediaPath: fullPath },
		);

	await TauriMediaRepository.upsert({
		mediaSourceId: sourceId,
		filePath: relativePath,
		fileName: basename(fullPath),
		mediaType,
		width: probe.width,
		height: probe.height,
		fileSize: probe.size,
		description: existing?.description ?? null,
		createdAt: new Date(probe.created_at),
		modifiedAt: new Date(probe.modified_at),
	});

	return existing ? 0 : 1;
}

async function syncLocalSource(source: MediaSource): Promise<SyncResult> {
	const rootPath = (source.connectionInfo as { path: string }).path;
	const fs = getTauriAppServices().fileSystem;
	const exists = await fs.exists(rootPath);

	if (!exists) {
		throw new Error(`Source path does not exist: ${rootPath}`);
	}

	const config = await TauriConfigService.getConfig();
	const existingRecords = await TauriMediaRepository.findAllPathsBySourceId(
		source.id,
	);
	const dbPathMap = new Map(
		existingRecords.map((record) => [
			normalizeRelativePath(record.filePath),
			record.id,
		]),
	);
	const scannedFiles = await scanDirectoryRecursive(rootPath);
	const actualMediaPaths = new Set<string>();
	let added = 0;

	for (const fullPath of scannedFiles) {
		const relativePath = toRelativePath(rootPath, fullPath);
		const mediaType = inferMediaType(
			relativePath,
			config.media.supportedExtensions,
		);
		if (!mediaType) {
			continue;
		}

		const normalizedRelativePath = normalizeRelativePath(relativePath);
		actualMediaPaths.add(normalizedRelativePath);
		added += await upsertSourceFile(source.id, rootPath, fullPath, mediaType);
	}

	let deleted = 0;
	for (const [relativePath, mediaId] of dbPathMap.entries()) {
		if (actualMediaPaths.has(relativePath)) {
			continue;
		}
		await TauriMediaRepository.delete(mediaId);
		deleted += 1;
	}

	return {
		id: source.id,
		success: true,
		added,
		deleted,
	};
}

export const TauriSourceService = {
	async list(): Promise<SafeMediaSource[]> {
		const sources = await TauriSourceRepository.findAll();
		return sources.map(toSafeMediaSource);
	},

	async get(id: string): Promise<SafeMediaSource | null> {
		const source = await TauriSourceRepository.findById(id);
		return source ? toSafeMediaSource(source) : null;
	},

	async create(input: NewMediaSource): Promise<SafeMediaSource> {
		if (input.type !== "local") {
			throw new Error("Tauri currently supports only local sources.");
		}
		const localPath = (input.connectionInfo as { path: string }).path;
		if (!(await getTauriAppServices().fileSystem.exists(localPath))) {
			throw new Error(`Source path does not exist: ${localPath}`);
		}
		const source = await TauriSourceRepository.create(input);
		await syncLocalSource(source);
		return toSafeMediaSource(source);
	},

	async update(
		id: string,
		input: Partial<MediaSource>,
	): Promise<SafeMediaSource> {
		if (input.type && input.type !== "local") {
			throw new Error("Tauri currently supports only local sources.");
		}
		const nextPath =
			input.connectionInfo && "path" in input.connectionInfo
				? input.connectionInfo.path
				: null;
		if (
			nextPath &&
			!(await getTauriAppServices().fileSystem.exists(nextPath))
		) {
			throw new Error(`Source path does not exist: ${nextPath}`);
		}
		const source = await TauriSourceRepository.update(id, input);
		return toSafeMediaSource(source);
	},

	async delete(id: string): Promise<void> {
		await TauriSourceRepository.delete(id);
	},

	async sync(ids: string[]) {
		const results: SyncResult[] = [];

		for (const id of ids) {
			try {
				const source = await TauriSourceRepository.findById(id);
				if (!source) {
					throw new Error(`Source not found: ${id}`);
				}
				if (source.type !== "local") {
					results.push({ id, success: true, added: 0, deleted: 0 });
					continue;
				}
				results.push(await syncLocalSource(source));
			} catch (error) {
				results.push({
					id,
					success: false,
					added: 0,
					deleted: 0,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}

		return { results };
	},
};
