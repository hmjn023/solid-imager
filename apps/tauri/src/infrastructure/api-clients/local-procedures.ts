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
	newAuthorSchema,
	presetSchema,
	updatePresetRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	newProjectSchema,
	updateProjectSchema,
} from "@solid-imager/core/domain/projects/schemas";
import {
	newTagSchema,
	tagResponseSchema,
	updateTagSchema,
} from "@solid-imager/core/domain/tags/schemas";
import { z } from "zod";
import { TauriAuthorService } from "../local-api/services/author-service";
import { TauriCharacterService } from "../local-api/services/character-service";
import { TauriConfigService } from "../local-api/services/config-service";
import { TauriIpService } from "../local-api/services/ip-service";
import { TauriPresetService } from "../local-api/services/preset-service";
import { TauriProjectService } from "../local-api/services/project-service";
import { TauriTagService } from "../local-api/services/tag-service";

const authorUpdateSchema = z.object({
	name: z.string().min(1).optional(),
	accountId: z.string().nullable().optional(),
});

const mutationSuccessSchema = z.object({ success: z.literal(true) });

const localProcedureHandlers = {
	"config.get": async () => await TauriConfigService.getConfig(),
	"config.update": async (input: unknown) =>
		await TauriConfigService.updateConfig(
			AppConfigSchema.partial().parse(input),
		),
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
