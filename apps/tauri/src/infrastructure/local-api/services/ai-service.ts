import type { JobRecord } from "@solid-imager/application/ports/job-repository";
import { orchestrateTagging } from "@solid-imager/application/services/ai-tagging-service";
import {
	createBatchTaggingDispatchJob,
	createBatchTaggingParentJob,
	scanBatchTaggingTargets,
} from "@solid-imager/application/services/batch-tagging";
import {
	createJobEventPublisher,
	runAutoTaggingJob,
	runBulkTaggingDispatchJob,
} from "@solid-imager/application/services/tagging-job-runner";
import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
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
	mediaCharacters,
	mediaIps,
	medias,
	mediaTags,
} from "@solid-imager/db/schema";
import { emit } from "@tauri-apps/api/event";
import { getTauriAppServices } from "~/app-services";
import { serverOrpc } from "../../api-clients/server-orpc-client";
import { joinLocalPath } from "../../path-utils";
import { TauriCharacterRepository } from "../repositories/character-repository";
import { TauriIpRepository } from "../repositories/ip-repository";
import { TauriMediaRepository } from "../repositories/media-repository";
import { TauriSourceRepository } from "../repositories/source-repository";
import { TauriTagRepository } from "../repositories/tag-repository";
import { TauriJobRepository } from "../repositories/tauri-job-repository";

const AI_SOURCE = "AI";

type BatchTaggingInput = {
	force?: boolean;
	mediaSourceId?: string;
};

type BatchTaggingWithIdsInput = BatchTaggingInput & {
	mediaIds: string[];
};

function createTauriAiClient(media: Media): IAiClient {
	return {
		healthCheck: async () => true,
		tagImage: async (buffer) => {
			const file = new File([buffer], media.fileName);
			return taggingResponseSchema.parse(await serverOrpc.ai.tag({ file }));
		},
		tagImageByPath: async (_path) => {
			throw new Error("Path-based AI tagging is not supported in Tauri client");
		},
		extractCcipFeature: async (_buffer) => {
			throw new Error(
				"CCIP feature extraction is not supported in Tauri client",
			);
		},
		extractCcipFeatureByPath: async (_path) => {
			throw new Error(
				"Path-based CCIP extraction is not supported in Tauri client",
			);
		},
		calculateCcipDifference: async (_f1, _f2) => {
			throw new Error(
				"CCIP difference calculation is not supported in Tauri client",
			);
		},
	};
}

async function persistAiTags(mediaId: string, response: TaggingResponse) {
	const { persistTaggingResponse } = await import(
		"@solid-imager/application/services/tag-persistence"
	);
	await getTauriAppServices().db.transaction(async (tx) => {
		await persistTaggingResponse(mediaId, response, {
			tagRepository: TauriTagRepository,
			ipRepository: TauriIpRepository,
			characterRepository: TauriCharacterRepository,
			source: AI_SOURCE,
			tx,
		});
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
		const rows = await scanBatchTaggingTargets(
			getTauriAppServices().db,
			input,
			{ medias, mediaTags, mediaCharacters, mediaIps },
		);

		const uniqueRows = new Map<string, (typeof rows)[number]>();
		for (const row of rows) {
			uniqueRows.set((row as any).id, row);
		}

		return Array.from(uniqueRows.values()).map((row) => mediaSchema.parse(row));
	},

	async batchTagging(input: BatchTaggingInput) {
		await createBatchTaggingDispatchJob(
			TauriJobRepository,
			input,
			batchTaggingRequestSchema.parse(input),
		);

		return {
			success: true,
			message: "Batch tagging started",
		};
	},

	async startBatchTaggingWithIds(input: BatchTaggingWithIdsInput) {
		return await createBatchTaggingParentJob(
			TauriJobRepository,
			async (ids) => {
				const mediaItems = await Promise.all(
					ids.map(async (id) => await TauriMediaRepository.findById(id)),
				);
				return mediaItems.flatMap((media) =>
					media ? [{ id: media.id, mediaSourceId: media.mediaSourceId }] : [],
				);
			},
			input,
		);
	},

	async applyTags(input: { mediaId: string; response: TaggingResponse }) {
		await persistAiTags(input.mediaId, input.response);
		await emitMediaChanged(input.mediaId);
		return { success: true as const };
	},

	async processAutoTaggingJob(job: JobRecord): Promise<void> {
		await runAutoTaggingJob(job, {
			jobRepository: TauriJobRepository,
			executeAutoTagging: async ({ mediaId, force }) => {
				const media = await TauriMediaRepository.findById(mediaId);
				if (!media) {
					throw new Error(`Media not found: ${mediaId}`);
				}
				const source = await TauriSourceRepository.findById(
					media.mediaSourceId,
				);
				if (!source) {
					throw new Error(`Media source not found: ${media.mediaSourceId}`);
				}
				if (source.type !== "local" || !("path" in source.connectionInfo)) {
					throw new Error(
						"AI tagging currently supports only local Tauri sources.",
					);
				}

				await orchestrateTagging(
					mediaId,
					{ skipCache: force },
					{
						aiClient: createTauriAiClient(media),
						reconstructDeps: {
							tagRepository: TauriTagRepository,
							characterRepository: TauriCharacterRepository,
							ipRepository: TauriIpRepository,
						},
						getAiBaseUrl: () => undefined,
						mediaSourceType: source.type,
						mediaSourceConnectionInfo: source.connectionInfo,
						mediaFilePath: media.filePath,
						getBuffer: async () => {
							const fullPath = joinLocalPath(
								(source.connectionInfo as { path: string }).path,
								media.filePath,
							);
							const bytes =
								await getTauriAppServices().fileSystem.readFile(fullPath);
							return bytes.buffer as ArrayBuffer;
						},
						joinPath: joinLocalPath,
						persistResponse: async (response) => {
							await persistAiTags(mediaId, response);
							await emitMediaChanged(mediaId);
						},
					},
				);
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
