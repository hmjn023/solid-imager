import type { MediaDumpItem } from "@solid-imager/core/domain/media/schemas";
import { mediaDumpItemSchema } from "@solid-imager/core/domain/media/schemas";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import { and, eq, inArray, sql } from "drizzle-orm";
import {
	authors,
	characterIps,
	characters,
	ips,
	mediaAuthors,
	mediaCharacters,
	mediaGenerationInfo,
	mediaIps,
	mediaProjects,
	medias,
	mediaTags,
	mediaUrls,
	projects,
	tags,
} from "./schema";
import type { DrizzleExecutor } from "./types";

export type BackupExecutorProvider = (tx?: unknown) => DrizzleExecutor;

export type BackupSource = {
	id?: string;
	type: string;
	connectionInfo: unknown;
};

export type BackupServiceDeps = {
	getExecutor: BackupExecutorProvider;
	sourceRepository: SourceRepository;
	resolvePath: (basePath: string, filePath: string) => string;
	pathExists: (fullPath: string) => Promise<boolean>;
	runTransaction?: <T>(
		callback: (executor: DrizzleExecutor) => Promise<T>,
	) => Promise<T>;
	onRestoreComplete?: (params: {
		source: BackupSource;
		mediaIds: string[];
		rootPath: string;
	}) => Promise<void> | void;
};

type MediaDumpQueryRow = Awaited<ReturnType<typeof loadMediaDumpItems>>[number];

type RestoreMasterDataResult = {
	tagMap: Map<string, string>;
	authorMap: Map<string, string>;
	projectMap: Map<string, string>;
	ipMap: Map<string, string>;
	charMap: Map<string, string>;
};

type ValidItemsResult = {
	validItems: MediaDumpItem[];
	skippedCount: number;
	errorMessages: string[];
};

type SimpleMasterDataTable =
	| typeof tags
	| typeof projects
	| typeof ips
	| typeof characters;

type SimpleMasterDataNameColumn =
	| typeof tags.name
	| typeof projects.name
	| typeof ips.name
	| typeof characters.name;

const MASTER_DATA_CHUNK_SIZE = 1000;
const AUTHOR_UPDATE_CHUNK_SIZE = 500;
const MEDIA_QUERY_CHUNK_SIZE = 1000;
const RESTORE_BATCH_SIZE = 500;
const PATH_EXISTS_CONCURRENCY = 50;

function isMediaSourcePath(pathValue: string): boolean {
	return /^(?:[A-Za-z]:[\\/]|\/)/.test(pathValue);
}

export function validateRelativePath(filePath: string): void {
	if (!filePath) {
		return;
	}

	const normalized = filePath.replace(/\\/g, "/");
	if (
		isMediaSourcePath(filePath) ||
		normalized.startsWith("/") ||
		normalized.split("/").some((segment) => segment === "..")
	) {
		throw new Error(`Invalid path in backup: ${filePath}`);
	}
}

async function loadMediaDumpItems(
	getExecutor: BackupExecutorProvider,
	mediaSourceId: string,
	offset = 0,
	limit = MEDIA_QUERY_CHUNK_SIZE,
) {
	return await getExecutor().query.medias.findMany({
		where: eq(medias.mediaSourceId, mediaSourceId),
		orderBy: (table, { asc }) => [asc(table.id)],
		limit,
		offset,
		with: {
			generationInfo: true,
			urls: true,
			tags: { with: { tag: true } },
			authors: { with: { author: true } },
			characters: {
				with: { character: { with: { ips: { with: { ip: true } } } } },
			},
			ips: { with: { ip: true } },
			projects: { with: { project: true } },
		},
	});
}

async function* iterateMediaDumpItems(
	getExecutor: BackupExecutorProvider,
	mediaSourceId: string,
): AsyncGenerator<MediaDumpItem, void, void> {
	let offset = 0;

	while (true) {
		const batch = await loadMediaDumpItems(getExecutor, mediaSourceId, offset);
		if (batch.length === 0) {
			break;
		}

		for (const item of transformMediaList(batch)) {
			yield item;
		}

		if (batch.length < MEDIA_QUERY_CHUNK_SIZE) {
			break;
		}

		offset += MEDIA_QUERY_CHUNK_SIZE;
	}
}

function transformMediaList(mediaList: MediaDumpQueryRow[]): MediaDumpItem[] {
	return mediaList.map((media) => ({
		id: media.id,
		filePath: media.filePath,
		fileName: media.fileName,
		description: media.description,
		width: media.width,
		height: media.height,
		fileSize: media.fileSize ?? undefined,
		mediaType: media.mediaType,
		createdAt: media.createdAt,
		modifiedAt: media.modifiedAt,
		sourceUrls: media.urls.map((item) => item.url),
		generationInfo: media.generationInfo
			? {
					prompt: media.generationInfo.prompt,
					negativePrompt: media.generationInfo.negativePrompt,
					modelName: media.generationInfo.modelName ?? undefined,
					seed: media.generationInfo.seed ?? undefined,
					steps: media.generationInfo.steps ?? undefined,
					cfgScale: media.generationInfo.cfgScale ?? undefined,
					aiGenerated: media.generationInfo.aiGenerated ?? undefined,
					workflow: media.generationInfo.workflow,
					metadata: media.generationInfo.metadata,
				}
			: null,
		tags: media.tags.map((item) => ({
			name: item.tag.name,
			type: item.tagType,
			confidence: item.confidence,
			source: item.source,
		})),
		authors: media.authors.map((item) => ({
			name: item.author.name,
			accountId: item.author.accountId,
		})),
		characters: media.characters.map((item) => ({
			name: item.character.name,
			description: item.character.description,
			confidence: item.confidence,
			linkedIps: item.character.ips.map((link) => link.ip.name),
			source: item.source,
		})),
		ips: media.ips.map((item) => ({
			name: item.ip.name,
			description: item.ip.description,
			confidence: item.confidence,
			source: item.source,
		})),
		projects: media.projects.map((item) => ({
			name: item.project.name,
			description: item.project.description,
		})),
	}));
}

async function ensureMasterData(
	executor: DrizzleExecutor,
	table: SimpleMasterDataTable,
	nameColumn: SimpleMasterDataNameColumn,
	names: Set<string>,
	defaults: Record<string, string | null>,
): Promise<Map<string, string>> {
	const nameList = Array.from(names);
	if (nameList.length === 0) {
		return new Map();
	}

	const result = new Map<string, string>();
	for (
		let index = 0;
		index < nameList.length;
		index += MASTER_DATA_CHUNK_SIZE
	) {
		const chunk = nameList.slice(index, index + MASTER_DATA_CHUNK_SIZE);
		await executor
			.insert(table)
			.values(chunk.map((name) => ({ name, ...defaults })))
			.onConflictDoNothing();

		const rows = await executor
			.select({
				id: table.id,
				name: nameColumn,
			})
			.from(table)
			.where(inArray(nameColumn, chunk));

		for (const row of rows) {
			result.set(row.name, row.id);
		}
	}

	return result;
}

async function ensureAuthors(
	executor: DrizzleExecutor,
	authorData: Map<string, { accountId?: string | null }>,
): Promise<Map<string, string>> {
	if (authorData.size === 0) {
		return new Map();
	}

	const entries = Array.from(authorData.entries());
	const nameList = entries.map(([name]) => name);
	const existingByName = new Map<
		string,
		{ id: string; accountId: string | null }
	>();
	for (
		let index = 0;
		index < nameList.length;
		index += MASTER_DATA_CHUNK_SIZE
	) {
		const chunk = nameList.slice(index, index + MASTER_DATA_CHUNK_SIZE);
		const existingRecords = await executor
			.select({
				id: authors.id,
				name: authors.name,
				accountId: authors.accountId,
			})
			.from(authors)
			.where(inArray(authors.name, chunk));

		for (const row of existingRecords) {
			const current = existingByName.get(row.name);
			if (!current || (!current.accountId && row.accountId)) {
				existingByName.set(row.name, {
					id: row.id,
					accountId: row.accountId,
				});
			}
		}
	}

	const updates = entries.filter(([name, data]) => {
		const current = existingByName.get(name);
		return Boolean(
			current && data.accountId && current.accountId !== data.accountId,
		);
	});

	if (updates.length > 0) {
		for (
			let index = 0;
			index < updates.length;
			index += AUTHOR_UPDATE_CHUNK_SIZE
		) {
			const chunk = updates.slice(index, index + AUTHOR_UPDATE_CHUNK_SIZE);
			const accountIdCase = sql.join(
				chunk.map(
					([name, data]) => sql`when ${name} then ${data.accountId ?? null}`,
				),
				sql.raw(" "),
			);
			await executor
				.update(authors)
				.set({
					accountId: sql`case ${authors.name} ${accountIdCase} else ${authors.accountId} end`,
					updatedAt: new Date(),
				})
				.where(
					inArray(
						authors.name,
						chunk.map(([name]) => name),
					),
				);
		}
	}

	const missing = entries.filter(([name]) => !existingByName.has(name));
	if (missing.length > 0) {
		for (
			let index = 0;
			index < missing.length;
			index += MASTER_DATA_CHUNK_SIZE
		) {
			const chunk = missing.slice(index, index + MASTER_DATA_CHUNK_SIZE);
			const created = await executor
				.insert(authors)
				.values(
					chunk.map(([name, data]) => ({
						name,
						accountId: data.accountId ?? null,
					})),
				)
				.returning();

			for (const row of created) {
				existingByName.set(row.name, { id: row.id, accountId: null });
			}
		}
	}

	return new Map(
		Array.from(existingByName.entries()).map(([name, row]) => [name, row.id]),
	);
}

async function restoreMasterData(
	executor: DrizzleExecutor,
	items: MediaDumpItem[],
): Promise<RestoreMasterDataResult> {
	const tagNames = new Set<string>();
	const authorData = new Map<string, { accountId?: string | null }>();
	const projectNames = new Set<string>();
	const charNames = new Set<string>();
	const ipNames = new Set<string>();

	for (const item of items) {
		for (const tag of item.tags ?? []) {
			if (tag.name) {
				tagNames.add(tag.name);
			}
		}

		for (const author of item.authors ?? []) {
			if (author.name && (!authorData.has(author.name) || author.accountId)) {
				authorData.set(author.name, { accountId: author.accountId });
			}
		}

		for (const project of item.projects ?? []) {
			if (project.name) {
				projectNames.add(project.name);
			}
		}

		for (const character of item.characters ?? []) {
			if (character.name) {
				charNames.add(character.name);
			}
			for (const linkedIp of character.linkedIps ?? []) {
				if (linkedIp) {
					ipNames.add(linkedIp);
				}
			}
		}

		for (const ip of item.ips ?? []) {
			if (ip.name) {
				ipNames.add(ip.name);
			}
		}
	}

	const [tagMap, authorMap, projectMap, ipMap, charMap] = await Promise.all([
		ensureMasterData(executor, tags, tags.name, tagNames, {
			source: "restored",
		}),
		ensureAuthors(executor, authorData),
		ensureMasterData(executor, projects, projects.name, projectNames, {
			description: "",
		}),
		ensureMasterData(executor, ips, ips.name, ipNames, {
			description: "",
			source: "restored",
		}),
		ensureMasterData(executor, characters, characters.name, charNames, {
			description: "",
			source: "restored",
		}),
	]);

	return { tagMap, authorMap, projectMap, ipMap, charMap };
}

async function restoreMediaRecords(
	executor: DrizzleExecutor,
	mediaSourceId: string,
	items: MediaDumpItem[],
) {
	const mediaValues = items.map((item) => ({
		mediaSourceId,
		filePath: item.filePath ?? "",
		fileName: item.fileName ?? "",
		description: item.description ?? null,
		width: item.width ?? 0,
		height: item.height ?? 0,
		fileSize: item.fileSize ?? 0,
		mediaType:
			item.mediaType === "image" || item.mediaType === "video"
				? item.mediaType
				: "image",
		createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
		modifiedAt: item.modifiedAt ? new Date(item.modifiedAt) : new Date(),
		indexedAt: new Date(),
		status: "active" as const,
	}));

	const chunkSize = 1000;
	for (let index = 0; index < mediaValues.length; index += chunkSize) {
		await executor
			.insert(medias)
			.values(mediaValues.slice(index, index + chunkSize))
			.onConflictDoUpdate({
				target: [medias.mediaSourceId, medias.filePath],
				set: {
					description: sql`excluded.description`,
					modifiedAt: sql`excluded.modified_at`,
					createdAt: sql`excluded.created_at`,
					width: sql`excluded.width`,
					height: sql`excluded.height`,
					fileSize: sql`excluded.file_size`,
					fileName: sql`excluded.file_name`,
					mediaType: sql`excluded.media_type`,
				},
			});
	}
}

async function mapMediaPathsToIds(
	getExecutor: BackupExecutorProvider,
	mediaSourceId: string,
	items: MediaDumpItem[],
): Promise<Map<string, string>> {
	const filePaths = items.flatMap((item) =>
		item.filePath ? [item.filePath] : [],
	);
	if (filePaths.length === 0) {
		return new Map();
	}

	const rows: Array<{ id: string; filePath: string }> = [];
	const chunkSize = 10_000;
	for (let index = 0; index < filePaths.length; index += chunkSize) {
		rows.push(
			...(await getExecutor().query.medias.findMany({
				where: and(
					eq(medias.mediaSourceId, mediaSourceId),
					inArray(medias.filePath, filePaths.slice(index, index + chunkSize)),
				),
				columns: {
					id: true,
					filePath: true,
				},
			})),
		);
	}

	return new Map(rows.map((row) => [row.filePath, row.id]));
}

async function restoreRelations(
	executor: DrizzleExecutor,
	params: {
		items: MediaDumpItem[];
		mediaPathToId: Map<string, string>;
		tagMap: Map<string, string>;
		authorMap: Map<string, string>;
		projectMap: Map<string, string>;
		ipMap: Map<string, string>;
		charMap: Map<string, string>;
	},
) {
	const mediaTagsData: Array<typeof mediaTags.$inferInsert> = [];
	const mediaAuthorsData: Array<typeof mediaAuthors.$inferInsert> = [];
	const mediaProjectsData: Array<typeof mediaProjects.$inferInsert> = [];
	const mediaCharactersData: Array<typeof mediaCharacters.$inferInsert> = [];
	const characterIpsData: Array<typeof characterIps.$inferInsert> = [];
	const mediaIpsData: Array<typeof mediaIps.$inferInsert> = [];
	const mediaUrlsData: Array<typeof mediaUrls.$inferInsert> = [];
	const mediaGenerationInfoData: Array<
		typeof mediaGenerationInfo.$inferInsert
	> = [];
	const seenMediaIps = new Set<string>();

	for (const item of params.items) {
		if (!item.filePath) {
			continue;
		}
		const mediaId = params.mediaPathToId.get(item.filePath);
		if (!mediaId) {
			continue;
		}

		for (const tag of item.tags ?? []) {
			const tagId = tag.name ? params.tagMap.get(tag.name) : undefined;
			if (tagId) {
				mediaTagsData.push({
					mediaId,
					tagId,
					tagType:
						tag.type === "positive" || tag.type === "negative"
							? tag.type
							: "positive",
					confidence: tag.confidence ?? null,
					source: tag.source ?? "restored",
				});
			}
		}

		for (const author of item.authors ?? []) {
			const authorId = author.name
				? params.authorMap.get(author.name)
				: undefined;
			if (authorId) {
				mediaAuthorsData.push({ mediaId, authorId });
			}
		}

		for (const project of item.projects ?? []) {
			const projectId = project.name
				? params.projectMap.get(project.name)
				: undefined;
			if (projectId) {
				mediaProjectsData.push({ mediaId, projectId });
			}
		}

		const mediaIpNames =
			item.ips?.flatMap((ip) => (ip.name ? [ip.name] : [])) ?? [];

		for (const character of item.characters ?? []) {
			const characterId = character.name
				? params.charMap.get(character.name)
				: undefined;
			if (!characterId) {
				continue;
			}

			mediaCharactersData.push({
				mediaId,
				characterId,
				confidence: character.confidence ?? null,
				source: character.source ?? "restored",
			});

			const ipNamesToLink =
				character.linkedIps &&
				Array.isArray(character.linkedIps) &&
				character.linkedIps.length > 0
					? character.linkedIps
					: mediaIpNames;

			for (const ipName of ipNamesToLink) {
				const ipId = params.ipMap.get(ipName);
				if (!ipId) {
					continue;
				}

				characterIpsData.push({
					characterId,
					ipId,
					source: "restored",
				});
			}
		}

		for (const ip of item.ips ?? []) {
			const ipId = ip.name ? params.ipMap.get(ip.name) : undefined;
			if (!ipId) {
				continue;
			}

			const mediaIpKey = `${mediaId}:${ipId}`;
			if (!seenMediaIps.has(mediaIpKey)) {
				mediaIpsData.push({
					mediaId,
					ipId,
					confidence: ip.confidence ?? null,
					source: ip.source ?? "restored",
				});
				seenMediaIps.add(mediaIpKey);
			}
		}

		for (const url of item.sourceUrls ?? []) {
			mediaUrlsData.push({ mediaId, url });
		}

		if (item.generationInfo) {
			mediaGenerationInfoData.push({
				mediaId,
				...item.generationInfo,
			});
		}
	}

	const chunkSize = 1000;
	for (let index = 0; index < mediaTagsData.length; index += chunkSize) {
		await executor
			.insert(mediaTags)
			.values(mediaTagsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaAuthorsData.length; index += chunkSize) {
		await executor
			.insert(mediaAuthors)
			.values(mediaAuthorsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaProjectsData.length; index += chunkSize) {
		await executor
			.insert(mediaProjects)
			.values(mediaProjectsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaCharactersData.length; index += chunkSize) {
		await executor
			.insert(mediaCharacters)
			.values(mediaCharactersData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < characterIpsData.length; index += chunkSize) {
		await executor
			.insert(characterIps)
			.values(characterIpsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaIpsData.length; index += chunkSize) {
		await executor
			.insert(mediaIps)
			.values(mediaIpsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaUrlsData.length; index += chunkSize) {
		await executor
			.insert(mediaUrls)
			.values(mediaUrlsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (
		let index = 0;
		index < mediaGenerationInfoData.length;
		index += chunkSize
	) {
		await executor
			.insert(mediaGenerationInfo)
			.values(mediaGenerationInfoData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
}

async function pathExistsParallel(
	checks: Array<{ item: MediaDumpItem; fullPath: string }>,
	pathExists: (fullPath: string) => Promise<boolean>,
): Promise<{ existing: MediaDumpItem[]; skipped: number }> {
	const existing: MediaDumpItem[] = [];
	let skipped = 0;

	for (let index = 0; index < checks.length; index += PATH_EXISTS_CONCURRENCY) {
		const chunk = checks.slice(index, index + PATH_EXISTS_CONCURRENCY);
		const results = await Promise.allSettled(
			chunk.map(async ({ item, fullPath }) => {
				const exists = await pathExists(fullPath);
				return { item, exists };
			}),
		);

		for (const result of results) {
			if (result.status === "fulfilled" && result.value.exists) {
				existing.push(result.value.item);
			} else {
				skipped += 1;
			}
		}
	}

	return { existing, skipped };
}

export async function filterValidItems(
	items: unknown[],
	mediaSource: BackupSource,
	pathExists: (fullPath: string) => Promise<boolean>,
	resolvePath: (basePath: string, filePath: string) => string,
): Promise<ValidItemsResult> {
	const connectionInfo = mediaSource.connectionInfo as { path?: string };
	const basePath = connectionInfo.path ?? "";
	const isLocal = mediaSource.type === "local";

	const preValidated: MediaDumpItem[] = [];
	const pathChecks: Array<{ item: MediaDumpItem; fullPath: string }> = [];
	const errorMessages: string[] = [];
	let skippedCount = 0;

	for (const item of items) {
		const parsed = mediaDumpItemSchema.safeParse(item);
		if (!parsed.success) {
			skippedCount += 1;
			errorMessages.push(`Validation failed: ${parsed.error.message}`);
			continue;
		}

		const validItem = parsed.data;
		if (!(validItem.filePath && validItem.fileName)) {
			skippedCount += 1;
			continue;
		}

		try {
			validateRelativePath(validItem.filePath);
		} catch (error) {
			skippedCount += 1;
			errorMessages.push((error as Error).message);
			continue;
		}

		if (isLocal) {
			const fullPath = resolvePath(basePath, validItem.filePath);
			pathChecks.push({ item: validItem, fullPath });
		} else {
			preValidated.push(validItem);
		}
	}

	if (pathChecks.length > 0) {
		const { existing, skipped } = await pathExistsParallel(
			pathChecks,
			pathExists,
		);
		preValidated.push(...existing);
		skippedCount += skipped;
	}

	return { validItems: preValidated, skippedCount, errorMessages };
}

export function createBackupService(deps: BackupServiceDeps) {
	async function findMediaSourceForFile(
		filePath: string,
	): Promise<string | null> {
		try {
			validateRelativePath(filePath);
		} catch {
			return null;
		}

		const sources = await deps.sourceRepository.findAll();
		for (const source of sources) {
			if (source.type !== "local") {
				continue;
			}

			const connectionInfo = source.connectionInfo as { path?: string };
			if (!connectionInfo.path) {
				continue;
			}

			const fullPath = deps.resolvePath(connectionInfo.path, filePath);
			try {
				if (await deps.pathExists(fullPath)) {
					return source.id ?? null;
				}
			} catch {
				// Continue scanning other sources.
			}
		}

		return null;
	}

	async function createDumpItems(
		mediaSourceId: string,
	): Promise<MediaDumpItem[]> {
		const source = await deps.sourceRepository.findById(mediaSourceId);
		if (!source) {
			throw new Error("Media source not found");
		}

		const mediaList: MediaDumpItem[] = [];
		for await (const media of iterateMediaDumpItems(
			deps.getExecutor,
			mediaSourceId,
		)) {
			mediaList.push(media);
		}
		return mediaList;
	}

	async function restoreSource(
		mediaSourceId: string,
		items: unknown[],
		opts?: {
			signal?: AbortSignal;
			onProgress?: (done: number, total: number) => void;
		},
	): Promise<{
		processed: number;
		skipped: number;
		errors: string[];
		cancelled?: boolean;
	}> {
		const source = await deps.sourceRepository.findById(mediaSourceId);
		if (!source) {
			throw new Error("Media source not found");
		}

		const totalItems = items.length;
		let totalProcessed = 0;
		let totalSkipped = 0;
		const allErrors: string[] = [];

		const runTransaction =
			deps.runTransaction ??
			(async <T>(callback: (executor: DrizzleExecutor) => Promise<T>) =>
				await callback(deps.getExecutor()));

		const rootPath = (source.connectionInfo as { path?: string }).path ?? "";

		for (let offset = 0; offset < items.length; offset += RESTORE_BATCH_SIZE) {
			if (opts?.signal?.aborted) {
				return {
					processed: totalProcessed,
					skipped: totalSkipped,
					errors: allErrors,
					cancelled: true,
				};
			}

			const batch = items.slice(offset, offset + RESTORE_BATCH_SIZE);
			const { validItems, skippedCount, errorMessages } =
				await filterValidItems(
					batch,
					source,
					deps.pathExists,
					deps.resolvePath,
				);
			totalSkipped += skippedCount;
			allErrors.push(...errorMessages);

			if (validItems.length === 0) {
				continue;
			}

			const { mediaPathToId } = await runTransaction(async (executor) => {
				const { tagMap, authorMap, projectMap, ipMap, charMap } =
					await restoreMasterData(executor, validItems);

				await restoreMediaRecords(executor, mediaSourceId, validItems);
				const nextMediaPathToId = await mapMediaPathsToIds(
					() => executor,
					mediaSourceId,
					validItems,
				);

				await restoreRelations(executor, {
					items: validItems,
					mediaPathToId: nextMediaPathToId,
					tagMap,
					authorMap,
					projectMap,
					ipMap,
					charMap,
				});

				return {
					mediaPathToId: nextMediaPathToId,
				};
			});

			totalProcessed += validItems.length;

			const mediaIds = Array.from(mediaPathToId.values());
			if (deps.onRestoreComplete && mediaIds.length > 0) {
				await deps.onRestoreComplete({
					source,
					mediaIds,
					rootPath,
				});
			}

			opts?.onProgress?.(totalProcessed, totalItems);
		}

		return {
			processed: totalProcessed,
			skipped: totalSkipped,
			errors: allErrors,
		};
	}

	return {
		findMediaSourceForFile,
		createDumpItems,
		iterateDumpItems: (mediaSourceId: string) =>
			iterateMediaDumpItems(deps.getExecutor, mediaSourceId),
		restoreSource,
		filterValidItems: (items: unknown[], mediaSource: BackupSource) =>
			filterValidItems(items, mediaSource, deps.pathExists, deps.resolvePath),
		transformMediaList,
		restoreMasterData,
		restoreMediaRecords,
		mapMediaPathsToIds,
		restoreRelations,
		validateRelativePath,
	};
}
