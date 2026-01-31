import type { SearchGroup } from "~/domain/media/schemas";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export const PresetClient = {
  list: async () => await orpc.presets.list(),
  get: async (id: number) => await orpc.presets.get({ id }),
  getByName: async (name: string) => await orpc.presets.getByName({ name }),
  create: async (data: { name: string; value: SearchGroup }) =>
    await orpc.presets.create(data),
  update: async (id: number, data: { name?: string; value?: SearchGroup }) =>
    await orpc.presets.update({ id, data }),
  delete: async (id: number) => await orpc.presets.delete({ id }),
};
