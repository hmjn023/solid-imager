import { client } from "~/orpc-client";

export const PresetClient = {
	list: () => client.presets.list(),
	get: (id: number) => client.presets.get({ id }),
	getByName: (name: string) => client.presets.getByName({ name }),
	create: (data: unknown) => client.presets.create(data as any),
	update: (id: number, data: unknown) => client.presets.update({ id, data: data as any }),
	delete: (id: number) => client.presets.delete({ id }),
};
