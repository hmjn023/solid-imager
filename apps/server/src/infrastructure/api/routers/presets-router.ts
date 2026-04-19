import { os } from "@orpc/server";
import {
	createPresetRequestSchema,
	updatePresetRequestSchema,
} from "@solid-imager/core/domain/media/schemas";
import { z } from "zod";
import { PresetService } from "~/application/services/preset-service";

/**
 * Presets Router Implementation
 */
export const presetsRouter = {
	/**
	 * List all presets
	 */
	list: os.handler(async () => await PresetService.list()),

	/**
	 * Get a specific preset
	 */
	get: os
		.input(z.object({ id: z.number().int() }))
		.handler(async ({ input }) => await PresetService.get(input.id)),

	/**
	 * Get a preset by name
	 */
	getByName: os
		.input(z.object({ name: z.string() }))
		.handler(async ({ input }) => await PresetService.getByName(input.name)),

	/**
	 * Create a new preset
	 */
	create: os
		.input(createPresetRequestSchema)
		.handler(async ({ input }) => await PresetService.create(input)),

	/**
	 * Update a preset
	 */
	update: os
		.input(
			z.object({
				id: z.number().int(),
				data: updatePresetRequestSchema,
			}),
		)
		.handler(async ({ input }) => await PresetService.update(input.id, input.data)),

	/**
	 * Delete a preset
	 */
	delete: os.input(z.object({ id: z.number().int() })).handler(async ({ input }) => {
		await PresetService.delete(input.id);
		return { success: true };
	}),
};
