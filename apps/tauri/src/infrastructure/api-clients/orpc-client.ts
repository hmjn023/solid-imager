import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import { characterSchema } from "@solid-imager/core/domain/characters/schemas";
import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import { ipSchema } from "@solid-imager/core/domain/ips/schemas";
import {
	type MediaDetails,
	type MediaSearchRequest,
	type MediaSearchResponse,
	mediaDetailsSchema,
	mediaSchema,
	mediaSearchResponseSchema,
	type Preset,
	presetSchema,
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
import type { TauriApiProcedure } from "../api/tauri-api-client";

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
const batchTaggingStartResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	jobId: z.string(),
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

async function invoke<TInput, TOutput>(
	procedure: TauriApiProcedure,
	input: TInput,
	schema: Parser<TOutput>,
): Promise<TOutput> {
	const result = await getTauriAppServices().apiClient.call<TInput, unknown>(
		procedure,
		input,
	);
	return schema.parse(result);
}

async function invokeVoid<TInput>(procedure: TauriApiProcedure, input: TInput) {
	await getTauriAppServices().apiClient.call<TInput, unknown>(procedure, input);
}

export const orpc = {
	config: {
		get: () => invoke("config.get", undefined, AppConfigSchema),
		update: (input: Partial<AppConfig>) =>
			invoke("config.update", input, AppConfigSchema),
	},
	sources: {
		list: () => invoke("sources.list", undefined, mediaSourceListSchema),
		get: (input: { id: string }) =>
			invoke("sources.get", input, safeMediaSourceSchema),
		create: (input: MediaSourceInfo) =>
			invoke("sources.create", input, safeMediaSourceSchema),
		update: (input: { id: string; data: Partial<MediaSourceInfo> }) =>
			invoke("sources.update", input, safeMediaSourceSchema),
		delete: (input: { id: string }) =>
			invoke("sources.delete", input, mutationSuccessSchema),
		sync: (input: { ids: string[] }) =>
			invoke("sources.sync", input, syncSourcesResponseSchema),
		restore: (input: { id: string; data: unknown[] }) =>
			invoke("sources.restore", input, z.any()),
		dump: (input: { id: string }) => invoke("sources.dump", input, z.any()),
		dumpZip: (input: { id: string }) =>
			invoke("sources.dumpZip", input, binaryFilePayloadSchema),
		importZip: (input: { id: string; bytes: number[] }) =>
			invoke("sources.importZip", input, z.any()),
	},
	media: {
		search: (input: { sourceId?: string | null; params: MediaSearchRequest }) =>
			invoke("media.search", input, mediaSearchResponseSchema),
		getDetails: (input: { sourceId: string; mediaId: string }) =>
			invoke("media.getDetails", input, mediaDetailsSchema),
		upload: (input: {
			sourceId: string;
			bytes: number[];
			filename?: string;
			description?: string;
			sourceUrl?: string;
			overwrite?: string;
			autoIncrement?: string;
		}) => invoke("media.upload", input, uploadResponseSchema),
		update: (input: {
			sourceId: string;
			mediaId: string;
			data: UpdateMediaRequest;
		}) => invoke("media.update", input, mediaDetailsSchema),
		delete: (input: { sourceId: string; mediaId: string }) =>
			invoke("media.delete", input, mutationSuccessSchema),
		copy: (input: { mediaId: string; targetSourceId: string }) =>
			invoke("media.copy", input, mutationSuccessSchema),
		move: (input: { mediaId: string; targetSourceId: string }) =>
			invoke("media.move", input, mutationSuccessSchema),
	},
	projects: {
		list: () => invoke("projects.list", undefined, projectListSchema),
		create: (input: { name: string; description?: string }) =>
			invoke("projects.create", input, projectSchema),
		update: (input: {
			id: string;
			data: { name?: string; description?: string };
		}) => invoke("projects.update", input, projectSchema),
		delete: (input: { id: string }) =>
			invoke("projects.delete", input, mutationSuccessSchema),
		listForMedia: (input: { mediaId: string }) =>
			invoke("projects.listForMedia", input, projectListSchema),
		addToMedia: (input: { mediaId: string; projectId: string }) =>
			invoke("projects.addToMedia", input, mutationSuccessSchema),
		removeFromMedia: (input: { mediaId: string; projectId: string }) =>
			invoke("projects.removeFromMedia", input, mutationSuccessSchema),
	},
	ips: {
		list: () => invoke("ips.list", undefined, ipListSchema),
		create: (input: { name: string; description?: string }) =>
			invoke("ips.create", input, ipSchema),
		update: (input: {
			id: string;
			data: { name?: string; description?: string };
		}) => invoke("ips.update", input, ipSchema),
		delete: (input: { id: string }) =>
			invoke("ips.delete", input, mutationSuccessSchema),
		listForMedia: (input: { mediaId: string }) =>
			invoke("ips.listForMedia", input, ipListSchema),
		addToMedia: (input: { mediaId: string; ipId: string }) =>
			invoke("ips.addToMedia", input, mutationSuccessSchema),
		removeFromMedia: (input: { mediaId: string; ipId: string }) =>
			invoke("ips.removeFromMedia", input, mutationSuccessSchema),
	},
	characters: {
		list: () => invoke("characters.list", undefined, characterListSchema),
		create: (input: { name: string; description?: string; ipIds?: string[] }) =>
			invoke("characters.create", input, characterSchema),
		update: (input: {
			id: string;
			data: { name?: string; description?: string; ipIds?: string[] };
		}) => invoke("characters.update", input, characterSchema),
		delete: (input: { id: string }) =>
			invoke("characters.delete", input, mutationSuccessSchema),
		listForMedia: (input: { mediaId: string }) =>
			invoke("characters.listForMedia", input, characterListSchema),
		addToMedia: (input: { mediaId: string; characterId: string }) =>
			invoke("characters.addToMedia", input, mutationSuccessSchema),
		removeFromMedia: (input: { mediaId: string; characterId: string }) =>
			invoke("characters.removeFromMedia", input, mutationSuccessSchema),
	},
	authors: {
		list: () => invoke("authors.list", undefined, authorListSchema),
		get: (input: { id: string }) =>
			invoke("authors.get", input, authorSchema.nullable()),
		create: (input: { name: string; accountId?: string | null }) =>
			invoke("authors.create", input, authorSchema),
		update: (input: {
			id: string;
			data: { name?: string; accountId?: string | null };
		}) => invoke("authors.update", input, authorSchema),
		delete: (input: { id: string }) =>
			invoke("authors.delete", input, mutationSuccessSchema),
	},
	tags: {
		list: () => invoke("tags.list", undefined, tagListSchema),
		get: (input: { id: string }) =>
			invoke("tags.get", input, tagResponseSchema.nullable()),
		create: (input: {
			name: string;
			description?: string;
			attribute?: string;
			color?: string;
			source?: string;
		}) => invoke("tags.create", input, tagResponseSchema),
		update: (input: {
			id: string;
			data: {
				name?: string;
				description?: string;
				attribute?: string;
				color?: string;
				source?: string;
			};
		}) => invoke("tags.update", input, tagResponseSchema),
		delete: (input: { id: string }) =>
			invoke("tags.delete", input, mutationSuccessSchema),
	},
	presets: {
		list: () => invoke("presets.list", undefined, presetListSchema),
		get: (input: { id: number }) => invoke("presets.get", input, presetSchema),
		getByName: (input: { name: string }) =>
			invoke("presets.getByName", input, presetSchema.nullable()),
		create: (input: {
			name: string;
			value: unknown;
			sort?: "name" | "date" | "rating" | "viewCount" | "size";
			order?: "asc" | "desc";
			mode?: "simple" | "pro";
		}) => invoke("presets.create", input, presetSchema),
		update: (input: {
			id: number;
			data: {
				name?: string;
				value?: unknown;
				sort?: "name" | "date" | "rating" | "viewCount" | "size";
				order?: "asc" | "desc";
				mode?: "simple" | "pro";
			};
		}) => invoke("presets.update", input, presetSchema),
		delete: (input: { id: number }) =>
			invoke("presets.delete", input, mutationSuccessSchema),
	},
	ai: {
		applyTags: (input: {
			mediaId: string;
			response: ReturnType<typeof taggingResponseSchema.parse>;
		}) => invoke("ai.applyTags", input, mutationSuccessSchema),
		scanBatchTaggingTargets: (input: {
			force?: boolean;
			mediaSourceId?: string;
		}) => invoke("ai.scanBatchTaggingTargets", input, mediaListSchema),
		startBatchTaggingWithIds: (input: {
			force?: boolean;
			mediaSourceId?: string;
			mediaIds: string[];
		}) =>
			invoke(
				"ai.startBatchTaggingWithIds",
				input,
				batchTaggingStartResponseSchema,
			),
	},
	_raw: {
		invokeVoid,
	},
};

export type TauriOrpcClient = typeof orpc;
export type TauriSafeMediaSource = SafeMediaSource;
export type TauriMediaSourceInfo = MediaSourceInfo;
export type TauriMediaSearchResponse = MediaSearchResponse;
export type TauriMediaDetails = MediaDetails;
export type TauriPreset = Preset;
