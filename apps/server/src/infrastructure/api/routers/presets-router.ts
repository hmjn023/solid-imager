import { implement } from "@orpc/server";
import { presetsContract } from "@solid-imager/core/domain/contract/presets.contract";
import { PresetService } from "~/infrastructure/services/preset-service";

/**
 * Presets Router Implementation
 */
const os = implement(presetsContract);

export const presetsRouter = os.router({
	/**
	 * List all presets
	 */
	list: os.list.handler(async () => await PresetService.list()),

	/**
	 * Get a specific preset
	 */
	get: os.get.handler(async ({ input }) => await PresetService.get(input.id)),

	/**
	 * Get a preset by name
	 */
	getByName: os.getByName.handler(
		async ({ input }) => await PresetService.getByName(input.name),
	),

	/**
	 * Create a new preset
	 */
	create: os.create.handler(
		async ({ input }) => await PresetService.create(input),
	),

	/**
	 * Update a preset
	 */
	update: os.update.handler(
		async ({ input }) => await PresetService.update(input.id, input.data),
	),

	/**
	 * Delete a preset
	 */
	delete: os.delete.handler(async ({ input }) => {
		await PresetService.delete(input.id);
		return { success: true };
	}),
});
