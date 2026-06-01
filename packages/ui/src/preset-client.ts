import type {
	Preset,
	SearchGroup,
} from "@solid-imager/core/domain/media/schemas";

export interface PresetOrpcLike {
	presets: {
		list(): Promise<Preset[]>;
		get(input: { id: number }): Promise<Preset>;
		getByName(input: { name: string }): Promise<Preset | null | undefined>;
		create(data: {
			name: string;
			value: SearchGroup;
			sort?: "name" | "date" | "rating" | "viewCount" | "size";
			order?: "asc" | "desc";
			mode?: "simple" | "pro";
		}): Promise<Preset>;
		update(input: {
			id: number;
			data: {
				name?: string;
				value?: SearchGroup;
				sort?: "name" | "date" | "rating" | "viewCount" | "size";
				order?: "asc" | "desc";
				mode?: "simple" | "pro";
			};
		}): Promise<Preset>;
		delete(input: { id: number }): Promise<unknown>;
	};
}

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
