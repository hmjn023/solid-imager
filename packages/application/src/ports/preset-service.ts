import type {
  CreatePresetRequest,
  Preset,
  UpdatePresetRequest,
} from "@solid-imager/core/domain/media/schemas";

export interface IPresetService {
  list(): Promise<Preset[]>;
  get(id: number): Promise<Preset>;
  getByName(name: string): Promise<Preset | null>;
  create(data: CreatePresetRequest): Promise<Preset>;
  update(id: number, data: UpdatePresetRequest): Promise<Preset>;
  delete(id: number): Promise<void>;
}
