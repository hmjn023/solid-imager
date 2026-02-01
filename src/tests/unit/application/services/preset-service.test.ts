import {
  ResourceConflictError,
  ResourceNotFoundError,
} from "@solid-imager/core/domain/errors";
import type {
  CreatePresetRequest,
  Preset,
  SearchGroup,
} from "@solid-imager/core/domain/media/schemas";
import type { PresetRepository } from "@solid-imager/core/domain/repositories/preset-repository";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  PresetService,
  setPresetRepository,
} from "~/application/services/preset-service";

const NON_EXISTENT_ID = 999;

describe("PresetService", () => {
  let mockRepo: PresetRepository;

  const mockPreset: Preset = {
    id: 1,
    name: "Test Preset",
    value: { type: "group", operator: "and", children: [] } as SearchGroup,
    createdAt: new Date(),
  };

  beforeEach(() => {
    mockRepo = {
      list: vi.fn(),
      get: vi.fn(),
      getByName: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    };
    setPresetRepository(mockRepo);
  });

  it("should list presets", async () => {
    (mockRepo.list as any).mockResolvedValue([mockPreset]);
    const result = await PresetService.list();
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual(mockPreset);
  });

  it("should create a preset if name does not exist", async () => {
    (mockRepo.getByName as any).mockResolvedValue(null);
    (mockRepo.create as any).mockResolvedValue(mockPreset);

    const input: CreatePresetRequest = {
      name: "Test Preset",
      value: mockPreset.value,
    };

    const result = await PresetService.create(input);
    expect(result).toEqual(mockPreset);
    expect(mockRepo.create).toHaveBeenCalledWith(input);
  });

  it("should throw ConflictError if creating with existing name", async () => {
    (mockRepo.getByName as any).mockResolvedValue(mockPreset);

    const input: CreatePresetRequest = {
      name: "Test Preset",
      value: mockPreset.value,
    };

    await expect(PresetService.create(input)).rejects.toThrow(
      ResourceConflictError
    );
  });

  it("should get a preset by id", async () => {
    (mockRepo.get as any).mockResolvedValue(mockPreset);
    const result = await PresetService.get(1);
    expect(result).toEqual(mockPreset);
  });

  it("should throw ResourceNotFoundError if getting non-existent preset", async () => {
    (mockRepo.get as any).mockResolvedValue(null);
    await expect(PresetService.get(NON_EXISTENT_ID)).rejects.toThrow(
      ResourceNotFoundError
    );
  });

  it("should update a preset", async () => {
    (mockRepo.get as any).mockResolvedValue(mockPreset); // Exists
    (mockRepo.getByName as any).mockResolvedValue(null); // No name conflict
    const updatedPreset = { ...mockPreset, name: "New Name" };
    (mockRepo.update as any).mockResolvedValue(updatedPreset);

    const result = await PresetService.update(1, { name: "New Name" });
    expect(result).toEqual(updatedPreset);
  });

  it("should delete a preset", async () => {
    (mockRepo.delete as any).mockResolvedValue(true);
    await expect(PresetService.delete(1)).resolves.not.toThrow();
  });

  it("should throw ResourceNotFoundError if deleting non-existent preset", async () => {
    (mockRepo.delete as any).mockResolvedValue(false);
    await expect(PresetService.delete(NON_EXISTENT_ID)).rejects.toThrow(
      ResourceNotFoundError
    );
  });
});
