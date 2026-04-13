import { authorSchema } from "@solid-imager/core/domain/authors/schemas";
import { AppConfigSchema } from "@solid-imager/core/domain/config/config-schema";
import {
	createPresetRequestSchema,
	newAuthorSchema,
	presetSchema,
	updatePresetRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import {
	newTagSchema,
	tagResponseSchema,
	updateTagSchema,
} from "@solid-imager/core/domain/tags/schemas";
import { z } from "zod";
import { TauriAuthorService } from "../local-api/services/author-service";
import { TauriConfigService } from "../local-api/services/config-service";
import { TauriPresetService } from "../local-api/services/preset-service";
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
