import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "~/application/registry";
import {
  CharacterService,
  CharacterServiceImpl,
} from "~/application/services/character-service";

// Mock Repositories
const mockCharacterRepo = {
  findById: vi.fn(),
  addToMedia: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  findByMediaId: vi.fn(),
  removeFromMedia: vi.fn(),
};

const mockIpRepo = {
  addMedia: vi.fn(),
  findByNames: vi.fn(),
  findByName: vi.fn(),
  create: vi.fn(),
};

describe("CharacterService", () => {
  beforeEach(() => {
    const mockTransactionManager = {
      transaction: vi.fn(async (cb) => await cb("mock-tx")),
    };
    const service = new CharacterServiceImpl(
      mockCharacterRepo as any,
      mockIpRepo as any,
      mockTransactionManager as any
    );
    services.registerCharacterService(service);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("addCharacterToMedia", () => {
    const mediaId = "media-1";
    const charId = "char-1";
    const ipId = "ip-1";

    it("should add character to media and auto-assign linked IPs", async () => {
      mockCharacterRepo.findById.mockResolvedValue({
        id: charId,
        name: "Char Name",
        ips: [{ id: ipId, name: "IP Name" }],
      });

      await CharacterService.addCharacterToMedia(mediaId, charId);

      expect(mockCharacterRepo.findById).toHaveBeenCalledWith(
        charId,
        "mock-tx"
      );
      expect(mockCharacterRepo.addToMedia).toHaveBeenCalledWith(
        mediaId,
        charId,
        undefined,
        undefined,
        "mock-tx"
      );
      expect(mockIpRepo.addMedia).toHaveBeenCalledWith(
        mediaId,
        ipId,
        undefined,
        "character_link",
        "mock-tx"
      );
    });

    it("should throw error if character not found", async () => {
      mockCharacterRepo.findById.mockResolvedValue(null);

      await expect(
        CharacterService.addCharacterToMedia(mediaId, charId)
      ).rejects.toThrow(`Character not found: ${charId}`);
    });
  });
});
