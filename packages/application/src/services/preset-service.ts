import type { IPresetService } from "../ports/preset-service";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import type { CreatePresetRequest, Preset, UpdatePresetRequest } from "@solid-imager/core/domain/media/schemas";
import { ResourceConflictError, ResourceNotFoundError } from "@solid-imager/core/domain/errors";

export function createPresetService(repo: PresetRepository): IPresetService {
  return {
    async list(): Promise<Preset[]> {
      return await repo.list();
    },

    async get(id: number): Promise<Preset> {
      const preset = await repo.get(id);
      if (!preset) {
        throw new ResourceNotFoundError("Preset", String(id));
      }
      return preset;
    },

    async getByName(name: string): Promise<Preset | null> {
      return await repo.getByName(name);
    },

    async create(data: CreatePresetRequest): Promise<Preset> {
      const existing = await repo.getByName(data.name);
      if (existing) {
        throw new ResourceConflictError(
          `Preset with name "${data.name}" already exists`,
        );
      }
      return repo.create(data);
    },

    async update(id: number, data: UpdatePresetRequest): Promise<Preset> {
      await this.get(id);

      if (data.name) {
        const existing = await repo.getByName(data.name);
        if (existing && existing.id !== id) {
          throw new ResourceConflictError(
            `Preset with name "${data.name}" already exists`,
          );
        }
      }

      const updated = await repo.update(id, data);
      if (!updated) {
        throw new ResourceNotFoundError("Preset", String(id));
      }
      return updated;
    },

    async delete(id: number): Promise<void> {
      const success = await repo.delete(id);
      if (!success) {
        throw new ResourceNotFoundError("Preset", String(id));
      }
    },
  };
}
