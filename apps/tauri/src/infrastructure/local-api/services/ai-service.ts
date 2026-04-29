import type { JobRecord } from "@solid-imager/application/ports/job-repository";
import {
	createJobEventPublisher,
	runAutoTaggingJob,
	runBulkTaggingDispatchJob,
} from "@solid-imager/application/services/tagging-job-runner";
import {
	type Media,
	mediaSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	batchTaggingRequestSchema,
	type TaggingResponse,
	taggingResponseSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import {
	characterIps,
	characters,
	ips,
	mediaCharacters,
	mediaIps,
	medias,
	mediaTags,
	tags,
} from "@solid-imager/db/schema";
import { emit } from "@tauri-apps/api/event";
import {
	and,
	asc,
	eq,
	getTableColumns,
	inArray,
	isNull,
	sql,
} from "drizzle-orm";
import { getTauriAppServices } from "~/app-services";
import { serverOrpc } from "../../api-clients/server-orpc-client";
import { joinLocalPath } from "../../path-utils";
import { TauriMediaRepository } from "../repositories/media-repository";
import { TauriSourceRepository } from "../repositories/source-repository";
import { TauriJobRepository } from "../repositories/tauri-job-repository";

const AI_SOURCE = "AI";

type BatchTaggingInput = {
	force?: boolean;
	mediaSourceId?: string;
};

type BatchTaggingWithIdsInput = BatchTaggingInput & {
	mediaIds: string[];
};

async function resolveLocalMediaFile(
	mediaId: string,
): Promise<{ media: Media; fullPath: string }> {
	const media = await TauriMediaRepository.findById(mediaId);
	if (!media) {
		throw new Error(`Media not found: ${mediaId}`);
	}

	const source = await TauriSourceRepository.findById(media.mediaSourceId);
	if (!source) {
		throw new Error(`Media source not found: ${media.mediaSourceId}`);
	}
	if (source.type !== "local" || !("path" in source.connectionInfo)) {
		throw new Error("AI tagging currently supports only local Tauri sources.");
	}

	return {
		media,
		fullPath: joinLocalPath(source.connectionInfo.path, media.filePath),
	};
}

async function tagMediaFromServer(mediaId: string): Promise<TaggingResponse> {
	const { media, fullPath } = await resolveLocalMediaFile(mediaId);
	const bytes = await getTauriAppServices().fileSystem.readFile(fullPath);
	const file = new File([bytes.buffer as ArrayBuffer], media.fileName);
	return taggingResponseSchema.parse(await serverOrpc.ai.tag({ file }));
}

async function persistAiTags(mediaId: string, response: TaggingResponse) {
	await getTauriAppServices().db.transaction(async (tx) => {
		await tx
			.delete(mediaTags)
			.where(
				and(eq(mediaTags.mediaId, mediaId), eq(mediaTags.source, AI_SOURCE)),
			);
		await tx
			.delete(mediaCharacters)
			.where(
				and(
					eq(mediaCharacters.mediaId, mediaId),
					eq(mediaCharacters.source, AI_SOURCE),
				),
			);
		await tx
			.delete(mediaIps)
			.where(
				and(eq(mediaIps.mediaId, mediaId), eq(mediaIps.source, AI_SOURCE)),
			);

		const generalTags = Object.entries(response.general);
		if (generalTags.length > 0) {
			const tagNames = generalTags.map(([name]) => name);
			await tx
				.insert(tags)
				.values(tagNames.map((name) => ({ name, source: AI_SOURCE })))
				.onConflictDoNothing();

			const persistedTags = await tx
				.select({ id: tags.id, name: tags.name })
				.from(tags)
				.where(inArray(tags.name, tagNames));
			const tagIdByName = new Map(
				persistedTags.map((item) => [item.name, item.id]),
			);

			const values = generalTags.flatMap(([name, confidence]) => {
				const tagId = tagIdByName.get(name);
				return tagId
					? [
							{
								mediaId,
								tagId,
								tagType: "positive" as const,
								confidence,
								source: AI_SOURCE,
							},
						]
					: [];
			});
			if (values.length > 0) {
				await tx
					.insert(mediaTags)
					.values(values)
					.onConflictDoUpdate({
						target: [mediaTags.mediaId, mediaTags.tagId, mediaTags.tagType],
						set: {
							confidence: sql`excluded.confidence`,
							source: sql`excluded.source`,
						},
					});
			}
		}

		if (response.ips.length > 0) {
			await tx
				.insert(ips)
				.values(response.ips.map((name) => ({ name, source: AI_SOURCE })))
				.onConflictDoNothing();
		}
		const persistedIps =
			response.ips.length > 0
				? await tx
						.select({ id: ips.id, name: ips.name })
						.from(ips)
						.where(inArray(ips.name, response.ips))
				: [];
		const ipIdByName = new Map(
			persistedIps.map((item) => [item.name, item.id]),
		);

		if (persistedIps.length > 0) {
			await tx
				.insert(mediaIps)
				.values(
					persistedIps.map((item) => ({
						mediaId,
						ipId: item.id,
						confidence: null,
						source: AI_SOURCE,
					})),
				)
				.onConflictDoUpdate({
					target: [mediaIps.mediaId, mediaIps.ipId],
					set: {
						confidence: sql`excluded.confidence`,
						source: sql`excluded.source`,
					},
				});
		}

		const charactersWithConfidence = Object.entries(response.character);
		if (charactersWithConfidence.length > 0) {
			const characterNames = charactersWithConfidence.map(([name]) => name);
			await tx
				.insert(characters)
				.values(characterNames.map((name) => ({ name, source: AI_SOURCE })))
				.onConflictDoNothing();

			const persistedCharacters = await tx
				.select({ id: characters.id, name: characters.name })
				.from(characters)
				.where(inArray(characters.name, characterNames));
			const characterIdByName = new Map(
				persistedCharacters.map((item) => [item.name, item.id]),
			);

			const characterIpValues = Object.entries(response.ips_mapping).flatMap(
				([characterName, linkedIpNames]) => {
					const characterId = characterIdByName.get(characterName);
					if (!characterId) {
						return [];
					}
					return linkedIpNames.flatMap((ipName) => {
						const ipId = ipIdByName.get(ipName);
						return ipId ? [{ characterId, ipId, source: AI_SOURCE }] : [];
					});
				},
			);
			if (characterIpValues.length > 0) {
				await tx
					.insert(characterIps)
					.values(characterIpValues)
					.onConflictDoNothing();
			}

			const mediaCharacterValues = charactersWithConfidence.flatMap(
				([characterName, confidence]) => {
					const characterId = characterIdByName.get(characterName);
					return characterId
						? [{ mediaId, characterId, confidence, source: AI_SOURCE }]
						: [];
				},
			);
			if (mediaCharacterValues.length > 0) {
				await tx
					.insert(mediaCharacters)
					.values(mediaCharacterValues)
					.onConflictDoUpdate({
						target: [mediaCharacters.mediaId, mediaCharacters.characterId],
						set: {
							confidence: sql`excluded.confidence`,
							source: sql`excluded.source`,
						},
					});
			}
		}
	});
}

async function emitMediaChanged(mediaId: string) {
	const media = await TauriMediaRepository.findById(mediaId);
	if (!media) {
		return;
	}
	await emit("media-changed", {
		mediaId,
		mediaSourceId: media.mediaSourceId,
		filePath: media.filePath,
		timestamp: new Date().toISOString(),
	});
}

const jobEvents = createJobEventPublisher(async (event, payload) => {
	await emit(event, payload);
});

export const TauriAiService = {
	async scanBatchTaggingTargets(input: BatchTaggingInput): Promise<Media[]> {
		const rows = await getTauriAppServices()
			.db.select({
				...getTableColumns(medias),
			})
			.from(medias)
			.leftJoin(
				mediaTags,
				and(eq(mediaTags.mediaId, medias.id), eq(mediaTags.source, AI_SOURCE)),
			)
			.leftJoin(
				mediaCharacters,
				and(
					eq(mediaCharacters.mediaId, medias.id),
					eq(mediaCharacters.source, AI_SOURCE),
				),
			)
			.leftJoin(
				mediaIps,
				and(eq(mediaIps.mediaId, medias.id), eq(mediaIps.source, AI_SOURCE)),
			)
			.where(
				and(
					eq(medias.mediaType, "image"),
					input.mediaSourceId
						? eq(medias.mediaSourceId, input.mediaSourceId)
						: undefined,
					input.force
						? undefined
						: and(
								isNull(mediaTags.mediaId),
								isNull(mediaCharacters.mediaId),
								isNull(mediaIps.mediaId),
							),
				),
			)
			.orderBy(asc(medias.id));

		const uniqueRows = new Map<string, (typeof rows)[number]>();
		for (const row of rows) {
			uniqueRows.set(row.id, row);
		}

		return Array.from(uniqueRows.values()).map((row) => mediaSchema.parse(row));
	},

	async batchTagging(input: BatchTaggingInput) {
		await TauriJobRepository.create({
			type: "bulk_tagging_dispatch",
			mediaSourceId: input.mediaSourceId,
			payload: batchTaggingRequestSchema.parse(input),
		});

		return {
			success: true,
			message: "Batch tagging started",
		};
	},

	async startBatchTaggingWithIds(input: BatchTaggingWithIdsInput) {
		const parentJob = await TauriJobRepository.create({
			type: "bulk_tagging_parent",
			mediaSourceId: input.mediaSourceId,
			status: "in_progress",
			payload: {
				total: input.mediaIds.length,
				processed: 0,
			},
		});

		const mediaItems = await Promise.all(
			input.mediaIds.map(
				async (mediaId) => await TauriMediaRepository.findById(mediaId),
			),
		);
		const foundMedia = mediaItems.flatMap((media) => (media ? [media] : []));

		await Promise.all(
			foundMedia.map(async (media) => {
				await TauriJobRepository.create({
					type: "auto_tagging",
					mediaSourceId: media.mediaSourceId,
					parentId: parentJob.id,
					payload: {
						mediaId: media.id,
						force: input.force,
					},
				});
			}),
		);

		return {
			success: true,
			message: "Batch tagging started with selected media.",
			jobId: parentJob.id,
		};
	},

	async applyTags(input: { mediaId: string; response: TaggingResponse }) {
		await persistAiTags(input.mediaId, input.response);
		await emitMediaChanged(input.mediaId);
		return { success: true as const };
	},

	async processAutoTaggingJob(job: JobRecord): Promise<void> {
		await runAutoTaggingJob(job, {
			jobRepository: TauriJobRepository,
			executeAutoTagging: async ({ mediaId }) => {
				const response = await tagMediaFromServer(mediaId);
				await persistAiTags(mediaId, response);
				await emitMediaChanged(mediaId);
			},
			jobEvents,
			logger: console,
		});
	},

	async processBulkTaggingDispatchJob(job: JobRecord): Promise<void> {
		await runBulkTaggingDispatchJob(job, {
			jobRepository: TauriJobRepository,
			scanTargets: async function* (payload) {
				const results = await TauriAiService.scanBatchTaggingTargets(payload);
				for (const media of results) {
					yield { id: media.id, mediaSourceId: media.mediaSourceId };
				}
			},
			logger: console,
		});
	},
};
