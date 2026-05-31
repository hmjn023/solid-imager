import type { PresetOrpcLike } from "@solid-imager/ui/preset-client";
import { client } from "~/orpc-client";

export const PresetClient: PresetOrpcLike = {
	presets: {
		list: () => client.presets.list() as any,
		get: (input) => client.presets.get(input) as any,
		getByName: (input) => client.presets.getByName(input) as any,
		create: (data) => client.presets.create(data) as any,
		update: (input) => client.presets.update(input) as any,
		delete: (input) => client.presets.delete(input) as any,
	},
};
