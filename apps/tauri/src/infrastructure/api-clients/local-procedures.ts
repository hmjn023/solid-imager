import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import {
	newCharacterSchema,
	updateCharacterSchema,
} from "@solid-imager/core/domain/characters/schemas";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import {
	newIpSchema,
	updateIpSchema,
} from "@solid-imager/core/domain/ips/schemas";
import {
	createPresetRequestSchema,
	mediaSearchRequestSchema,
	newAuthorSchema,
	presetSchema,
	updateMediaRequestSchema,
	updatePresetRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import { uploadMediaRequestSchema } from "@solid-imager/core/domain/media/upload-schemas";
import {
	newProjectSchema,
	updateProjectSchema,
} from "@solid-imager/core/domain/projects/schemas";
import { mediaSourceInfoSchema } from "@solid-imager/core/domain/sources/schemas";
import {
	batchTaggingRequestSchema,
	taggingResponseSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import {
	newTagSchema,
	tagResponseSchema,
	updateTagSchema,
} from "@solid-imager/core/domain/tags/schemas";
import { z } from "zod";
import { TauriAiService } from "../local-api/services/ai-service";
import { TauriAuthorService } from "../local-api/services/author-service";
import { TauriCharacterService } from "../local-api/services/character-service";
import { TauriConfigService } from "../local-api/services/config-service";
import { TauriIpService } from "../local-api/services/ip-service";
import { TauriMediaService } from "../local-api/services/media-service";
import { TauriPresetService } from "../local-api/services/preset-service";
import { TauriProjectService } from "../local-api/services/project-service";
import { TauriSourceBackupService } from "../local-api/services/source-backup-service";
import { TauriSourceService } from "../local-api/services/source-service";
import { TauriTagService } from "../local-api/services/tag-service";

const authorUpdateSchema = z.object({
	name: z.string().min(1).optional(),
	accountId: z.string().nullable().optional(),
});
const uuidSchema = z.string().uuid();

const mutationSuccessSchema = z.object({ success: z.literal(true) });
const batchTaggingWithIdsSchema = z.object({
	force: z.boolean().optional(),
	batchSize: z.number().optional(),
	mediaSourceId: z.string().optional(),
	mediaIds: z.array(uuidSchema),
});

const localProcedureHandlers = {
	"config.get": async () => await TauriConfigService.getConfig(),
	"config.update": async (input: unknown) =>
		await TauriConfigService.updateConfig(
			AppConfigSchema.partial().parse(input),
		),
	"sources.list": async () => await TauriSourceService.list(),
	"sources.get": async (input: unknown) => {
		const { id } = z.object({ id: uuidSchema }).parse(input);
		const source = await TauriSourceService.get(id);
		if (!source) {
			throw new Error(`Source not found: ${id}`);
		}
		return source;
	},
	"sources.create": async (input: unknown) =>
		await TauriSourceService.create(mediaSourceInfoSchema.parse(input)),
	"sources.update": async (input: unknown) => {
		const { id, data } = z
			.object({
				id: uuidSchema,
				data: z.unknown(),
			})
			.parse(input);
		return await TauriSourceService.update(
			id,
			mediaSourceInfoSchema.partial().parse(data),
		);
	},
	"sources.delete": async (input: unknown) => {
		const { id } = z.object({ id: uuidSchema }).parse(input);
		await TauriSourceService.delete(id);
		return mutationSuccessSchema.parse({ success: true });
	},
	"sources.sync": async (input: unknown) => {
		const { ids } = z
			.object({
				ids: z.array(uuidSchema),
			})
			.parse(input);
		return await TauriSourceService.sync(ids);
	},
	"sources.dump": async (input: unknown) => {
		const { id } = z.object({ id: uuidSchema }).parse(input);
		return await TauriSourceBackupService.createDump(id, "json");
	},
	"sources.dumpZip": async (input: unknown) => {
		const { id } = z.object({ id: uuidSchema }).parse(input);
		return await TauriSourceBackupService.createDump(id, "zip");
	},
	"sources.restore": async (input: unknown) => {
		const { id, data } = z
			.object({
				id: uuidSchema,
				data: z.array(z.unknown()),
			})
			.parse(input);
		await TauriSourceService.sync([id]);
		return await TauriSourceBackupService.restoreSource(id, data);
	},
	"sources.importZip": async (input: unknown) => {
		const { id, bytes } = z
			.object({
				id: uuidSchema,
				bytes: z.array(z.number().int().min(0).max(255)),
			})
			.parse(input);
		return await TauriSourceBackupService.importSourceZip(id, bytes);
	},
	"media.search": async (input: unknown) => {
		const { sourceId, params } = z
			.object({
				sourceId: uuidSchema.nullish(),
				params: z.unknown(),
			})
			.parse(input);
		return await TauriMediaService.search(
			sourceId,
			mediaSearchRequestSchema.parse(params),
		);
	},
	"media.getDetails": async (input: unknown) => {
		const { sourceId, mediaId } = z
			.object({
				sourceId: uuidSchema,
				mediaId: uuidSchema,
			})
			.parse(input);
		return await TauriMediaService.getDetails(sourceId, mediaId);
	},
	"media.update": async (input: unknown) => {
		const { sourceId, mediaId, data } = z
			.object({
				sourceId: uuidSchema,
				mediaId: uuidSchema,
				data: z.unknown(),
			})
			.parse(input);
		return await TauriMediaService.update(
			sourceId,
			mediaId,
			updateMediaRequestSchema.parse(data),
		);
	},
	"media.upload": async (input: unknown) => {
		const {
			sourceId,
			bytes,
			filename,
			description,
			sourceUrl,
			overwrite,
			autoIncrement,
		} = z
			.object({
				sourceId: uuidSchema,
				bytes: z.array(z.number().int().min(0).max(255)),
				filename: z.string().optional(),
				description: z.string().optional(),
				sourceUrl: z.string().optional(),
				overwrite: z.string().optional(),
				autoIncrement: z.string().optional(),
			})
			.parse(input);
		const parsedRequest = uploadMediaRequestSchema.parse({
			filename,
			description,
			sourceUrl,
			overwrite,
			autoIncrement,
		});
		return await TauriMediaService.upload(sourceId, bytes, {
			filename: parsedRequest.filename,
			description: parsedRequest.description,
			sourceUrl: parsedRequest.sourceUrl,
			overwrite,
			autoIncrement,
		});
	},
	"media.delete": async (input: unknown) => {
		const { sourceId, mediaId } = z
			.object({
				sourceId: uuidSchema,
				mediaId: uuidSchema,
			})
			.parse(input);
		return await TauriMediaService.delete(sourceId, mediaId);
	},
	"media.copy": async (input: unknown) => {
		const { mediaId, targetSourceId } = z
			.object({
				mediaId: uuidSchema,
				targetSourceId: uuidSchema,
			})
			.parse(input);
		return await TauriMediaService.copy(mediaId, targetSourceId);
	},
	"media.move": async (input: unknown) => {
		const { mediaId, targetSourceId } = z
			.object({
				mediaId: uuidSchema,
				targetSourceId: uuidSchema,
			})
			.parse(input);
		return await TauriMediaService.move(mediaId, targetSourceId);
	},
	"authors.list": async () => await TauriAuthorService.list(),
	"authors.get": async (input: unknown) => {
		const { id } = z.object({ id: z.string().uuid() }).parse(input);
		return await TauriAuthorService.get(id);
	},
	"authors.create": async (input: unknown) =>
		await TauriAuthorService.create(newAuthorSchema.parse(input)),
	"authors.update": async (input: unknown) => {
		const { id, data } = z
			.object({
				id: z.string().uuid(),
				data: authorUpdateSchema,
			})
			.parse(input);
		return await TauriAuthorService.update(id, data);
	},
	"authors.delete": async (input: unknown) => {
		const { id } = z.object({ id: z.string().uuid() }).parse(input);
		await TauriAuthorService.delete(id);
		return mutationSuccessSchema.parse({ success: true });
	},
	"projects.list": async () => await TauriProjectService.list(),
	"projects.create": async (input: unknown) =>
		await TauriProjectService.create(newProjectSchema.parse(input)),
	"projects.update": async (input: unknown) => {
		const { id, data } = z
			.object({
				id: z.string().uuid(),
				data: z.unknown(),
			})
			.parse(input);
		return await TauriProjectService.update(
			id,
			updateProjectSchema.parse(data),
		);
	},
	"projects.delete": async (input: unknown) => {
		const { id } = z.object({ id: z.string().uuid() }).parse(input);
		await TauriProjectService.delete(id);
		return mutationSuccessSchema.parse({ success: true });
	},
	"projects.listForMedia": async (input: unknown) => {
		const { mediaId } = z.object({ mediaId: z.string().uuid() }).parse(input);
		return await TauriProjectService.listForMedia(mediaId);
	},
	"projects.addToMedia": async (input: unknown) => {
		const { mediaId, projectId } = z
			.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			})
			.parse(input);
		await TauriProjectService.addToMedia(mediaId, projectId);
		return mutationSuccessSchema.parse({ success: true });
	},
	"projects.removeFromMedia": async (input: unknown) => {
		const { mediaId, projectId } = z
			.object({
				mediaId: z.string().uuid(),
				projectId: z.string().uuid(),
			})
			.parse(input);
		await TauriProjectService.removeFromMedia(mediaId, projectId);
		return mutationSuccessSchema.parse({ success: true });
	},
	"ips.list": async () => await TauriIpService.list(),
	"ips.create": async (input: unknown) =>
		await TauriIpService.create(newIpSchema.parse(input)),
	"ips.update": async (input: unknown) => {
		const { id, data } = z
			.object({
				id: z.string().uuid(),
				data: z.unknown(),
			})
			.parse(input);
		return await TauriIpService.update(id, updateIpSchema.parse(data));
	},
	"ips.delete": async (input: unknown) => {
		const { id } = z.object({ id: z.string().uuid() }).parse(input);
		await TauriIpService.delete(id);
		return mutationSuccessSchema.parse({ success: true });
	},
	"ips.listForMedia": async (input: unknown) => {
		const { mediaId } = z.object({ mediaId: z.string().uuid() }).parse(input);
		return await TauriIpService.listForMedia(mediaId);
	},
	"ips.addToMedia": async (input: unknown) => {
		const { mediaId, ipId } = z
			.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			})
			.parse(input);
		await TauriIpService.addToMedia(mediaId, ipId);
		return mutationSuccessSchema.parse({ success: true });
	},
	"ips.removeFromMedia": async (input: unknown) => {
		const { mediaId, ipId } = z
			.object({
				mediaId: z.string().uuid(),
				ipId: z.string().uuid(),
			})
			.parse(input);
		await TauriIpService.removeFromMedia(mediaId, ipId);
		return mutationSuccessSchema.parse({ success: true });
	},
	"characters.list": async () => await TauriCharacterService.list(),
	"characters.create": async (input: unknown) =>
		await TauriCharacterService.create(newCharacterSchema.parse(input)),
	"characters.update": async (input: unknown) => {
		const { id, data } = z
			.object({
				id: z.string().uuid(),
				data: z.unknown(),
			})
			.parse(input);
		return await TauriCharacterService.update(
			id,
			updateCharacterSchema.parse(data),
		);
	},
	"characters.delete": async (input: unknown) => {
		const { id } = z.object({ id: z.string().uuid() }).parse(input);
		await TauriCharacterService.delete(id);
		return mutationSuccessSchema.parse({ success: true });
	},
	"characters.listForMedia": async (input: unknown) => {
		const { mediaId } = z.object({ mediaId: z.string().uuid() }).parse(input);
		return await TauriCharacterService.listForMedia(mediaId);
	},
	"characters.addToMedia": async (input: unknown) => {
		const { mediaId, characterId } = z
			.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			})
			.parse(input);
		await TauriCharacterService.addToMedia(mediaId, characterId);
		return mutationSuccessSchema.parse({ success: true });
	},
	"characters.removeFromMedia": async (input: unknown) => {
		const { mediaId, characterId } = z
			.object({
				mediaId: z.string().uuid(),
				characterId: z.string().uuid(),
			})
			.parse(input);
		await TauriCharacterService.removeFromMedia(mediaId, characterId);
		return mutationSuccessSchema.parse({ success: true });
	},
	"tags.list": async () => await TauriTagService.list(),
	"tags.get": async (input: unknown) => {
		const { id } = z.object({ id: z.string().uuid() }).parse(input);
		return await TauriTagService.get(id);
	},
	"tags.create": async (input: unknown) =>
		await TauriTagService.create(newTagSchema.parse(input)),
	"tags.update": async (input: unknown) => {
		const { id, data } = z
			.object({
				id: z.string().uuid(),
				data: z.unknown(),
			})
			.parse(input);
		return await TauriTagService.update(id, updateTagSchema.parse(data));
	},
	"tags.delete": async (input: unknown) => {
		const { id } = z.object({ id: z.string().uuid() }).parse(input);
		await TauriTagService.delete(id);
		return mutationSuccessSchema.parse({ success: true });
	},
	"presets.list": async () => await TauriPresetService.list(),
	"presets.get": async (input: unknown) => {
		const { id } = z.object({ id: z.number().int() }).parse(input);
		return await TauriPresetService.get(id);
	},
	"presets.getByName": async (input: unknown) => {
		const { name } = z.object({ name: z.string() }).parse(input);
		return await TauriPresetService.getByName(name);
	},
	"presets.create": async (input: unknown) =>
		await TauriPresetService.create(createPresetRequestSchema.parse(input)),
	"presets.update": async (input: unknown) => {
		const { id, data } = z
			.object({
				id: z.number().int(),
				data: z.unknown(),
			})
			.parse(input);
		return await TauriPresetService.update(
			id,
			updatePresetRequestSchema.parse(data),
		);
	},
	"presets.delete": async (input: unknown) => {
		const { id } = z.object({ id: z.number().int() }).parse(input);
		await TauriPresetService.delete(id);
		return mutationSuccessSchema.parse({ success: true });
	},
	"ai.applyTags": async (input: unknown) => {
		const parsed = z
			.object({
				mediaId: uuidSchema,
				response: z.unknown(),
			})
			.parse(input);
		return await TauriAiService.applyTags({
			mediaId: parsed.mediaId,
			response: taggingResponseSchema.parse(parsed.response),
		});
	},
	"ai.scanBatchTaggingTargets": async (input: unknown) =>
		await TauriAiService.scanBatchTaggingTargets(
			batchTaggingRequestSchema.parse(input ?? {}),
		),
	"ai.startBatchTaggingWithIds": async (input: unknown) => {
		const parsed = batchTaggingWithIdsSchema.parse(input);
		return await TauriAiService.startBatchTaggingWithIds(parsed);
	},
} as const;

export function isLocalProcedure(
	procedure: string,
): procedure is keyof typeof localProcedureHandlers {
	return procedure in localProcedureHandlers;
}

export async function invokeLocalProcedure(
	procedure: keyof typeof localProcedureHandlers,
	input: unknown,
) {
	return await localProcedureHandlers[procedure](input);
}

export const localProcedureSchemas = {
	author: authorSchema,
	tag: tagResponseSchema,
	preset: presetSchema,
	config: AppConfigSchema,
};
