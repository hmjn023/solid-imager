import type { PresetOrpcLike } from "@solid-imager/core/domain/contract/presets-client";
import type { SearchGroup } from "@solid-imager/core/domain/media/schemas";

export type { PresetOrpcLike } from "@solid-imager/core/domain/contract/presets-client";

export function createPresetClient(orpc: PresetOrpcLike) {
	return {
		list: async () => await orpc.presets.list(),
		get: async (id: number) => await orpc.presets.get({ id }),
		getByName: async (name: string) => await orpc.presets.getByName({ name }),
		create: async (data: {
			name: string;
			value: SearchGroup;
			sort?: "name" | "date" | "rating" | "viewCount" | "size";
			order?: "asc" | "desc";
			mode?: "simple" | "pro";
		}) => await orpc.presets.create(data),
		update: async (
			id: number,
			data: {
				name?: string;
				value?: SearchGroup;
				sort?: "name" | "date" | "rating" | "viewCount" | "size";
				order?: "asc" | "desc";
				mode?: "simple" | "pro";
			},
		) => await orpc.presets.update({ id, data }),
		delete: async (id: number) => await orpc.presets.delete({ id }),
	};
}

export type PresetClientType = ReturnType<typeof createPresetClient>;
