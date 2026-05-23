import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import { characterSchema } from "@solid-imager/core/domain/characters/schemas";
import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import { ipSchema } from "@solid-imager/core/domain/ips/schemas";
import {
	type DownloadItem,
	type MediaDetails,
	type MediaSearchRequest,
	type MediaSearchResponse,
	mediaDetailsSchema,
	mediaSchema,
	mediaSearchResponseSchema,
	type Preset,
	presetSchema,
	searchGroupSchema,
	type UpdateMediaRequest,
	uploadResponseSchema,
} from "@solid-imager/core/domain/media/schemas";
import { projectSchema } from "@solid-imager/core/domain/projects/schemas";
import {
	type MediaSourceInfo,
	type SafeMediaSource,
	safeMediaSourceSchema,
} from "@solid-imager/core/domain/sources/schemas";
import type { taggingResponseSchema } from "@solid-imager/core/domain/tagging/schemas";
import { tagResponseSchema } from "@solid-imager/core/domain/tags/schemas";
import { z } from "zod";
import { getTauriAppServices } from "~/app-services";

import { enqueueDownloadJobs } from "../jobs/download-jobs";
import { tauriJobQueue } from "../jobs/tauri-job-queue";

const mutationSuccessSchema = z.object({ success: z.boolean() });
const syncSourcesResponseSchema = z.object({
	results: z.array(
		z.object({
			id: z.string(),
			success: z.boolean(),
			added: z.number().optional(),
			updated: z.number().optional(),
			deleted: z.number().optional(),
			error: z.string().optional(),
		}),
	),
});
const binaryFilePayloadSchema = z.object({
	fileName: z.string(),
	mimeType: z.string(),
	data: z.array(z.number().int().min(0).max(255)),
});
const restoreSourceResultSchema = z.object({
	processed: z.number(),
	skipped: z.number(),
	errors: z.array(z.string()),
	cancelled: z.boolean().optional(),
});
const importSourceZipResultSchema = z.object({
	success: z.boolean(),
	importedCount: z.number(),
	skippedCount: z.number(),
	errors: z.array(z.string()),
	message: z.string(),
});
const batchTaggingStartResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	jobId: z.string(),
});
const bulkDownloadResponseSchema = z.object({
	success: z.boolean(),
	jobCount: z.number(),
	message: z.string(),
});

type Parser<TOutput> = {
	parse: (input: unknown) => TOutput;
};

function parseArray<TOutput>(schema: Parser<TOutput>): Parser<TOutput[]> {
	return {
		parse: (input: unknown) =>
			z
				.array(z.unknown())
				.parse(input)
				.map((item) => schema.parse(item)),
	};
}

const mediaSourceListSchema = parseArray(safeMediaSourceSchema);
const projectListSchema = parseArray(projectSchema);
const ipListSchema = parseArray(ipSchema);
const characterListSchema = parseArray(characterSchema);
const authorListSchema = parseArray(authorSchema);
const tagListSchema = parseArray(tagResponseSchema);
const mediaListSchema = parseArray(mediaSchema);
const presetListSchema = parseArray(presetSchema);

export const orpc = {
	config: {
		get: async () => {
			const res = await getTauriAppServices().configService.getConfig();
			return AppConfigSchema.parse(res);
		},
		update: async (input: Partial<AppConfig>) => {
			const res = await getTauriAppServices().configService.updateConfig(input);
			return AppConfigSchema.parse(res);
		},
	},
	sources: {
		list: async () => {
			const res = await getTauriAppServices().sourceService.list();
			return mediaSourceListSchema.parse(res);
		},
		get: async (input: { id: string }) => {
			const res = await getTauriAppServices().sourceService.get(input.id);
			if (!res) {
				throw new Error(`Source not found: ${input.id}`);
			}
			return safeMediaSourceSchema.parse(res);
		},
		create: async (input: MediaSourceInfo) => {
			const res = await getTauriAppServices().sourceService.create(input);
			return safeMediaSourceSchema.parse(res);
		},
		update: async (input: { id: string; data: Partial<MediaSourceInfo> }) => {
			const res = await getTauriAppServices().sourceService.update(input.id, input.data);
			return safeMediaSourceSchema.parse(res);
		},
		delete: async (input: { id: string }) => {
			await getTauriAppServices().sourceService.delete(input.id);
			return mutationSuccessSchema.parse({ success: true });
		},
		sync: async (input: { ids: string[] }) => {
			const res = await getTauriAppServices().sourceService.sync(input.ids);
			return syncSourcesResponseSchema.parse(res);
		},
		restore: async (input: { id: string; data: unknown[] }) => {
			const res = await getTauriAppServices().sourceBackupService.restoreSource(input.id, input.data);
			return restoreSourceResultSchema.parse(res);
		},
		dump: async (input: { id: string }) => {
			const res = await getTauriAppServices().sourceBackupService.createDump(input.id, "json");
			return res;
		},
		dumpZip: async (input: { id: string }) => {
			const res = await getTauriAppServices().sourceBackupService.createDump(input.id, "zip");
			return binaryFilePayloadSchema.parse(res);
		},
		importZip: async (input: { id: string; bytes: number[] }) => {
			const res = await getTauriAppServices().sourceBackupService.importSourceZip(input.id, {
				type: "bytes",
				bytes: input.bytes,
			});
			return importSourceZipResultSchema.parse(res);
		},
	},
	media: {
		search: async (input: { sourceId?: string | null; params: MediaSearchRequest }) => {
			const res = await getTauriAppServices().mediaService.searchMedia(input.sourceId ?? null, input.params);
			return mediaSearchResponseSchema.parse(res);
		},
		getDetails: async (input: { sourceId: string; mediaId: string }) => {
			const res = await getTauriAppServices().mediaService.getMediaDetails(input.sourceId, input.mediaId);
			return mediaDetailsSchema.parse(res);
		},
		upload: async (input: {
			sourceId: string;
			bytes: number[];
			filename?: string;
			description?: string;
			sourceUrl?: string;
			overwrite?: string;
			autoIncrement?: string;
		}) => {
			const res = await getTauriAppServices().mediaService.uploadMedia(input.sourceId, input.bytes, {
				filename: input.filename,
				description: input.description,
				sourceUrl: input.sourceUrl,
				overwrite: input.overwrite === "true",
				autoIncrement: input.autoIncrement === "true",
			});
			return uploadResponseSchema.parse(res);
		},
		update: async (input: {
			sourceId: string;
			mediaId: string;
			data: UpdateMediaRequest;
		}) => {
			const res = await getTauriAppServices().mediaService.updateMedia(input.sourceId, input.mediaId, input.data);
			return mediaDetailsSchema.parse(res);
		},
		delete: async (input: { sourceId: string; mediaId: string }) => {
			await getTauriAppServices().mediaService.deleteMedia(input.sourceId, input.mediaId);
			return mutationSuccessSchema.parse({ success: true });
		},
		copy: async (input: { mediaId: string; targetSourceId: string }) => {
			const res = await getTauriAppServices().mediaService.copyMedia("", input.mediaId, input.targetSourceId);
			return mutationSuccessSchema.parse(res);
		},
		move: async (input: { mediaId: string; targetSourceId: string }) => {
			const res = await getTauriAppServices().mediaService.moveMedia("", input.mediaId, input.targetSourceId);
			return mutationSuccessSchema.parse(res);
		},
	},
	downloads: {
		start: async (input: { mediaSourceId: string; items: unknown[] }) => {
			const jobCount = await enqueueDownloadJobs(input.mediaSourceId, input.items as DownloadItem[]);
			tauriJobQueue.wake();
			return bulkDownloadResponseSchema.parse({
				success: true,
				jobCount,
				message: `Queued ${jobCount} download jobs`,
			});
		},
	},
	projects: {
		list: async () => {
			const res = await getTauriAppServices().projectService.list();
			return projectListSchema.parse(res);
		},
		create: async (input: { name: string; description?: string }) => {
			const res = await getTauriAppServices().projectService.create(input);
			return projectSchema.parse(res);
		},
		update: async (input: {
			id: string;
			data: { name?: string; description?: string };
		}) => {
			const res = await getTauriAppServices().projectService.update(input.id, input.data);
			return projectSchema.parse(res);
		},
		delete: async (input: { id: string }) => {
			await getTauriAppServices().projectService.delete(input.id);
			return mutationSuccessSchema.parse({ success: true });
		},
		listForMedia: async (input: { mediaId: string }) => {
			const res = await getTauriAppServices().projectService.listForMedia(input.mediaId);
			return projectListSchema.parse(res);
		},
		addToMedia: async (input: { mediaId: string; projectId: string }) => {
			await getTauriAppServices().projectService.addToMedia(input.mediaId, input.projectId);
			return mutationSuccessSchema.parse({ success: true });
		},
		removeFromMedia: async (input: { mediaId: string; projectId: string }) => {
			await getTauriAppServices().projectService.removeFromMedia(input.mediaId, input.projectId);
			return mutationSuccessSchema.parse({ success: true });
		},
	},
	ips: {
		list: async () => {
			const res = await getTauriAppServices().ipService.list();
			return ipListSchema.parse(res);
		},
		create: async (input: { name: string; description?: string }) => {
			const res = await getTauriAppServices().ipService.create(input);
			return ipSchema.parse(res);
		},
		update: async (input: {
			id: string;
			data: { name?: string; description?: string };
		}) => {
			const res = await getTauriAppServices().ipService.update(input.id, input.data);
			return ipSchema.parse(res);
		},
		delete: async (input: { id: string }) => {
			await getTauriAppServices().ipService.delete(input.id);
			return mutationSuccessSchema.parse({ success: true });
		},
		listForMedia: async (input: { mediaId: string }) => {
			const res = await getTauriAppServices().ipService.listForMedia(input.mediaId);
			return ipListSchema.parse(res);
		},
		addToMedia: async (input: { mediaId: string; ipId: string }) => {
			await getTauriAppServices().ipService.addToMedia(input.mediaId, input.ipId);
			return mutationSuccessSchema.parse({ success: true });
		},
		removeFromMedia: async (input: { mediaId: string; ipId: string }) => {
			await getTauriAppServices().ipService.removeFromMedia(input.mediaId, input.ipId);
			return mutationSuccessSchema.parse({ success: true });
		},
	},
	characters: {
		list: async () => {
			const res = await getTauriAppServices().characterService.list();
			return characterListSchema.parse(res);
		},
		create: async (input: { name: string; description?: string; ipIds?: string[] }) => {
			const res = await getTauriAppServices().characterService.create(input);
			return characterSchema.parse(res);
		},
		update: async (input: {
			id: string;
			data: { name?: string; description?: string; ipIds?: string[] };
		}) => {
			const res = await getTauriAppServices().characterService.update(input.id, input.data);
			return characterSchema.parse(res);
		},
		delete: async (input: { id: string }) => {
			await getTauriAppServices().characterService.delete(input.id);
			return mutationSuccessSchema.parse({ success: true });
		},
		listForMedia: async (input: { mediaId: string }) => {
			const res = await getTauriAppServices().characterService.listForMedia(input.mediaId);
			return characterListSchema.parse(res);
		},
		addToMedia: async (input: { mediaId: string; characterId: string }) => {
			await getTauriAppServices().characterService.addToMedia(input.mediaId, input.characterId);
			return mutationSuccessSchema.parse({ success: true });
		},
		removeFromMedia: async (input: { mediaId: string; characterId: string }) => {
			await getTauriAppServices().characterService.removeFromMedia(input.mediaId, input.characterId);
			return mutationSuccessSchema.parse({ success: true });
		},
	},
	authors: {
		list: async () => {
			const res = await getTauriAppServices().authorService.list();
			return authorListSchema.parse(res);
		},
		get: async (input: { id: string }) => {
			const res = await getTauriAppServices().authorService.get(input.id);
			return authorSchema.nullable().parse(res);
		},
		create: async (input: { name: string; accountId?: string | null }) => {
			const res = await getTauriAppServices().authorService.create(input);
			return authorSchema.parse(res);
		},
		update: async (input: {
			id: string;
			data: { name?: string; accountId?: string | null };
		}) => {
			const res = await getTauriAppServices().authorService.update(input.id, input.data);
			return authorSchema.parse(res);
		},
		delete: async (input: { id: string }) => {
			await getTauriAppServices().authorService.delete(input.id);
			return mutationSuccessSchema.parse({ success: true });
		},
	},
	tags: {
		list: async () => {
			const res = await getTauriAppServices().tagService.list();
			return tagListSchema.parse(res);
		},
		get: async (input: { id: string }) => {
			const res = await getTauriAppServices().tagService.get(input.id);
			return tagResponseSchema.nullable().parse(res);
		},
		create: async (input: {
			name: string;
			description?: string;
			attribute?: string;
			color?: string;
			source?: string;
		}) => {
			const res = await getTauriAppServices().tagService.create(input);
			return tagResponseSchema.parse(res);
		},
		update: async (input: {
			id: string;
			data: {
				name?: string;
				description?: string;
				attribute?: string;
				color?: string;
				source?: string;
			};
		}) => {
			const res = await getTauriAppServices().tagService.update(input.id, input.data);
			return tagResponseSchema.parse(res);
		},
		delete: async (input: { id: string }) => {
			await getTauriAppServices().tagService.delete(input.id);
			return mutationSuccessSchema.parse({ success: true });
		},
	},
	presets: {
		list: async () => {
			const res = await getTauriAppServices().presetService.list();
			return presetListSchema.parse(res);
		},
		get: async (input: { id: number }) => {
			const res = await getTauriAppServices().presetService.get(input.id);
			return presetSchema.parse(res);
		},
		getByName: async (input: { name: string }) => {
			const res = await getTauriAppServices().presetService.getByName(input.name);
			return presetSchema.nullable().parse(res);
		},
		create: async (input: {
			name: string;
			value: unknown;
			sort?: "name" | "date" | "rating" | "viewCount" | "size";
			order?: "asc" | "desc";
			mode?: "simple" | "pro";
		}) => {
			const res = await getTauriAppServices().presetService.create({
				...input,
				value: searchGroupSchema.parse(input.value),
			});
			return presetSchema.parse(res);
		},
		update: async (input: {
			id: number;
			data: {
				name?: string;
				value?: unknown;
				sort?: "name" | "date" | "rating" | "viewCount" | "size";
				order?: "asc" | "desc";
				mode?: "simple" | "pro";
			};
		}) => {
			const res = await getTauriAppServices().presetService.update(input.id, {
				...input.data,
				value: input.data.value !== undefined ? searchGroupSchema.parse(input.data.value) : undefined,
			});
			return presetSchema.parse(res);
		},
		delete: async (input: { id: number }) => {
			await getTauriAppServices().presetService.delete(input.id);
			return mutationSuccessSchema.parse({ success: true });
		},
	},
	ai: {
		applyTags: async (input: {
			mediaId: string;
			response: ReturnType<typeof taggingResponseSchema.parse>;
		}) => {
			const res = await getTauriAppServices().aiService.applyTags(input);
			return mutationSuccessSchema.parse(res);
		},
		batchTagging: async (input: { force?: boolean; mediaSourceId?: string }) => {
			const res = await getTauriAppServices().aiService.batchTagging(input);
			tauriJobQueue.wake();
			return mutationSuccessSchema.extend({ message: z.string() }).parse(res);
		},
		scanBatchTaggingTargets: async (input: {
			force?: boolean;
			mediaSourceId?: string;
		}) => {
			const res = await getTauriAppServices().aiService.scanBatchTaggingTargets(input);
			return mediaListSchema.parse(res);
		},
		startBatchTaggingWithIds: async (input: {
			force?: boolean;
			mediaSourceId?: string;
			mediaIds: string[];
		}) => {
			const res = await getTauriAppServices().aiService.startBatchTaggingWithIds(input);
			tauriJobQueue.wake();
			return batchTaggingStartResponseSchema.parse(res);
		},
	},
	_raw: {
		invokeVoid: async <TInput>(procedure: string, _input: TInput) => {
			throw new Error(`Direct invokeVoid of ${procedure} is no longer supported after DI refactoring.`);
		},
	},
};

export type TauriOrpcClient = typeof orpc;
export type TauriSafeMediaSource = SafeMediaSource;
export type TauriMediaSourceInfo = MediaSourceInfo;
export type TauriMediaSearchResponse = MediaSearchResponse;
export type TauriMediaDetails = MediaDetails;
export type TauriPreset = Preset;
