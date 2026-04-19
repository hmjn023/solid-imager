import {
	type MediaDumpItem,
	mediaDumpItemSchema,
} from "@solid-imager/core/domain/media/schemas";
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
} from "@solid-imager/db/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";
import { joinLocalPath } from "~/infrastructure/path-utils";
import { TauriSourceRepository } from "../repositories/source-repository";
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

type ImportSourceZipResult = {
	success: boolean;
	importedCount: number;
	skippedCount: number;
	errors: string[];
	message: string;
};

function validateRelativePath(filePath: string): void {
	const normalized = filePath.replace(/\\/g, "/");
	if (
		normalized.length === 0 ||
		/^(?:[A-Za-z]:\/|\/)/.test(normalized) ||
		normalized.split("/").some((segment) => segment === "..")
	) {
		throw new Error(`Invalid path in backup: ${filePath}`);
	}
}

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

async function ensureMasterData(
	tx: TauriDbExecutor,
	table: typeof tags | typeof projects | typeof ips | typeof characters,
	nameColumn:
		| typeof tags.name
		| typeof projects.name
		| typeof ips.name
		| typeof characters.name,
	names: Set<string>,
	defaults: Record<string, string | null>,
): Promise<Map<string, string>> {
	const nameList = Array.from(names);
	if (nameList.length === 0) {
		return new Map();
	}

	await tx
		.insert(table)
		.values(nameList.map((name) => ({ name, ...defaults })))
		.onConflictDoNothing();

	const rows = await tx
		.select({
			id: table.id,
			name: nameColumn,
		})
		.from(table)
		.where(inArray(nameColumn, nameList));

	return new Map(rows.map((row) => [row.name, row.id]));
}

async function ensureAuthors(
	tx: TauriDbExecutor,
	authorData: Map<string, { accountId?: string | null }>,
): Promise<Map<string, string>> {
	if (authorData.size === 0) {
		return new Map();
	}

	const entries = Array.from(authorData.entries());
	const names = entries.map(([name]) => name);
	const existing = await tx
		.select({
			id: authors.id,
			name: authors.name,
			accountId: authors.accountId,
		})
		.from(authors)
		.where(inArray(authors.name, names));

	const existingByName = new Map<
		string,
		{ id: string; accountId: string | null }
	>();
	for (const row of existing) {
		const current = existingByName.get(row.name);
		if (!current || (!current.accountId && row.accountId)) {
			existingByName.set(row.name, {
				id: row.id,
				accountId: row.accountId,
			});
		}
	}

	const authorUpdates = entries.filter(([name, data]) => {
		const current = existingByName.get(name);
		return Boolean(
			current && data.accountId && current.accountId !== data.accountId,
		);
	});

	if (authorUpdates.length > 0) {
		const accountIdCase = sql.join(
			authorUpdates.map(
				([name, data]) => sql`when ${name} then ${data.accountId ?? null}`,
			),
			sql.raw(" "),
		);
		await tx
			.update(authors)
			.set({
				accountId: sql`case ${authors.name} ${accountIdCase} else ${authors.accountId} end`,
				updatedAt: new Date(),
			})
			.where(
				inArray(
					authors.name,
					authorUpdates.map(([name]) => name),
				),
			);
	}

	const missing = entries.filter(([name]) => !existingByName.has(name));
	if (missing.length > 0) {
		const created = await tx
			.insert(authors)
			.values(
				missing.map(([name, data]) => ({
					name,
					accountId: data.accountId ?? null,
				})),
			)
			.returning({
				id: authors.id,
				name: authors.name,
			});

		for (const row of created) {
			existingByName.set(row.name, { id: row.id, accountId: null });
		}
	}

	return new Map(
		Array.from(existingByName.entries()).map(([name, row]) => [name, row.id]),
	);
}

async function restoreMasterData(tx: TauriDbExecutor, items: MediaDumpItem[]) {
	const tagNames = new Set<string>();
	const authorData = new Map<string, { accountId?: string | null }>();
	const projectNames = new Set<string>();
	const characterNames = new Set<string>();
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
				characterNames.add(character.name);
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
		ensureMasterData(tx, tags, tags.name, tagNames, { source: "restored" }),
		ensureAuthors(tx, authorData),
		ensureMasterData(tx, projects, projects.name, projectNames, {
			description: "",
		}),
		ensureMasterData(tx, ips, ips.name, ipNames, {
			description: "",
			source: "restored",
		}),
		ensureMasterData(tx, characters, characters.name, characterNames, {
			description: "",
			source: "restored",
		}),
	]);

	return { tagMap, authorMap, projectMap, ipMap, charMap };
}

async function restoreMediaRecords(
	tx: TauriDbExecutor,
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
		mediaType: item.mediaType ?? "image",
		createdAt: item.createdAt ? new Date(item.createdAt) : new Date(),
		modifiedAt: item.modifiedAt ? new Date(item.modifiedAt) : new Date(),
		indexedAt: new Date(),
		status: "active" as const,
	}));

	const chunkSize = 1000;
	for (let index = 0; index < mediaValues.length; index += chunkSize) {
		await tx
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
	tx: TauriDbExecutor,
	mediaSourceId: string,
	items: MediaDumpItem[],
): Promise<Map<string, string>> {
	const filePaths = items
		.map((item) => item.filePath)
		.filter((filePath): filePath is string => Boolean(filePath));
	if (filePaths.length === 0) {
		return new Map();
	}

	const rows: Array<{ id: string; filePath: string }> = [];
	const chunkSize = 10_000;
	for (let index = 0; index < filePaths.length; index += chunkSize) {
		rows.push(
			...(await tx.query.medias.findMany({
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
	tx: TauriDbExecutor,
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
					tagType: tag.type ?? "positive",
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

			for (const linkedIp of character.linkedIps ?? []) {
				const ipId = params.ipMap.get(linkedIp);
				if (!ipId) {
					continue;
				}

				characterIpsData.push({
					characterId,
					ipId,
					source: "restored",
				});

				const mediaIpKey = `${mediaId}:${ipId}`;
				if (!seenMediaIps.has(mediaIpKey)) {
					mediaIpsData.push({
						mediaId,
						ipId,
						confidence: character.confidence ?? null,
						source: "character_link",
					});
					seenMediaIps.add(mediaIpKey);
				}
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

	const mediaIds = Array.from(params.mediaPathToId.values());
	const deleteChunkSize = 1000;
	for (let index = 0; index < mediaIds.length; index += deleteChunkSize) {
		const chunk = mediaIds.slice(index, index + deleteChunkSize);
		await tx.delete(mediaTags).where(inArray(mediaTags.mediaId, chunk));
		await tx.delete(mediaAuthors).where(inArray(mediaAuthors.mediaId, chunk));
		await tx.delete(mediaProjects).where(inArray(mediaProjects.mediaId, chunk));
		await tx
			.delete(mediaCharacters)
			.where(inArray(mediaCharacters.mediaId, chunk));
		await tx.delete(mediaIps).where(inArray(mediaIps.mediaId, chunk));
		await tx.delete(mediaUrls).where(inArray(mediaUrls.mediaId, chunk));
		await tx
			.delete(mediaGenerationInfo)
			.where(inArray(mediaGenerationInfo.mediaId, chunk));
	}

	const chunkSize = 1000;

	for (let index = 0; index < mediaTagsData.length; index += chunkSize) {
		await tx
			.insert(mediaTags)
			.values(mediaTagsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaAuthorsData.length; index += chunkSize) {
		await tx
			.insert(mediaAuthors)
			.values(mediaAuthorsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaProjectsData.length; index += chunkSize) {
		await tx
			.insert(mediaProjects)
			.values(mediaProjectsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaCharactersData.length; index += chunkSize) {
		await tx
			.insert(mediaCharacters)
			.values(mediaCharactersData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < characterIpsData.length; index += chunkSize) {
		await tx
			.insert(characterIps)
			.values(characterIpsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaIpsData.length; index += chunkSize) {
		await tx
			.insert(mediaIps)
			.values(mediaIpsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (let index = 0; index < mediaUrlsData.length; index += chunkSize) {
		await tx
			.insert(mediaUrls)
			.values(mediaUrlsData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
	for (
		let index = 0;
		index < mediaGenerationInfoData.length;
		index += chunkSize
	) {
		await tx
			.insert(mediaGenerationInfo)
			.values(mediaGenerationInfoData.slice(index, index + chunkSize))
			.onConflictDoNothing();
	}
}

export const TauriSourceBackupService = {
	async createDump(
		mediaSourceId: string,
		mode: "json" | "zip" = "json",
	): Promise<MediaDumpItem[] | BinaryFilePayload> {
		const source = await TauriSourceRepository.findById(mediaSourceId);
		const rootPath = toLocalSourcePath(source);
		const mediaList = await getTauriAppServices().db.query.medias.findMany({
			where: eq(medias.mediaSourceId, mediaSourceId),
			orderBy: (table, { asc }) => [asc(table.id)],
			with: {
				generationInfo: true,
				urls: true,
				tags: { with: { tag: true } },
				authors: { with: { author: true } },
				characters: {
					with: {
						character: {
							with: {
								ips: {
									with: { ip: true },
								},
							},
						},
					},
				},
				ips: { with: { ip: true } },
				projects: { with: { project: true } },
			},
		});

		const items: MediaDumpItem[] = mediaList.map((media) => ({
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
			sourceUrls: media.urls.map((url) => url.url),
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

		if (mode === "json") {
			return items;
		}

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
		const source = await TauriSourceRepository.findById(mediaSourceId);
		const rootPath = toLocalSourcePath(source);
		const fileSystem = getTauriAppServices().fileSystem;
		const validItems: MediaDumpItem[] = [];
		const errors: string[] = [];
		let skipped = 0;

		for (const item of items) {
			const parsed = mediaDumpItemSchema.safeParse(item);
			if (!parsed.success) {
				skipped += 1;
				errors.push(`Validation failed: ${parsed.error.message}`);
				continue;
			}

			const validItem = parsed.data;
			if (!(validItem.filePath && validItem.fileName)) {
				skipped += 1;
				continue;
			}

			try {
				validateRelativePath(validItem.filePath);
			} catch (error) {
				skipped += 1;
				errors.push((error as Error).message);
				continue;
			}

			try {
				await fileSystem.stat(joinLocalPath(rootPath, validItem.filePath));
			} catch {
				skipped += 1;
				continue;
			}

			validItems.push(validItem);
		}

		if (validItems.length === 0) {
			return {
				processed: 0,
				skipped,
				errors,
			};
		}

		await getTauriAppServices().db.transaction(async (tx) => {
			const { tagMap, authorMap, projectMap, ipMap, charMap } =
				await restoreMasterData(tx, validItems);
			await restoreMediaRecords(tx, mediaSourceId, validItems);
			const mediaPathToId = await mapMediaPathsToIds(
				tx,
				mediaSourceId,
				validItems,
			);
			await restoreRelations(tx, {
				items: validItems,
				mediaPathToId,
				tagMap,
				authorMap,
				projectMap,
				ipMap,
				charMap,
			});
		});

		return {
			processed: validItems.length,
			skipped,
			errors,
		};
	},

	async importSourceZip(
		mediaSourceId: string,
		bytes: number[],
	): Promise<ImportSourceZipResult> {
		const source = await TauriSourceRepository.findById(mediaSourceId);
		const rootPath = toLocalSourcePath(source);
		const dumpData = await getTauriAppServices().commandClient.invoke<
			unknown[]
		>("backup_extract_zip", {
			rootPath,
			bytes,
		});

		await TauriSourceService.sync([mediaSourceId]);
		const restoreResult = await this.restoreSource(mediaSourceId, dumpData);

		return {
			success: true,
			importedCount: restoreResult.processed,
			skippedCount: restoreResult.skipped,
			errors: restoreResult.errors,
			message: `Successfully imported ${restoreResult.processed} items (Skipped: ${restoreResult.skipped})`,
		};
	},
};
