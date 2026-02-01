import type {
  CreatePresetRequest,
  Preset,
  UpdatePresetRequest,
} from "@/domain/media/schemas";

export type PresetRepository = {
  list(): Promise<Preset[]>;
  get(id: number): Promise<Preset | null>;
  getByName(name: string): Promise<Preset | null>;
  create(data: CreatePresetRequest): Promise<Preset>;
  update(id: number, data: UpdatePresetRequest): Promise<Preset | null>;
  delete(id: number): Promise<boolean>;
};
