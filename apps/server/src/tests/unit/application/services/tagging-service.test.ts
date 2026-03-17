import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository } from "@solid-imager/core/domain/repositories/tag-repository";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { TaggingService } from "~/application/services/tagging-service";

// biome-ignore lint/style/noMagicNumbers: Test data
const MOCK_BUFFER_DATA = [1, 2, 3];
const _NON_EXISTENT_ID = 999;

// Mock MediaService
vi.mock("~/application/services/media-service", () => ({
  MediaService: {
    getMedia: vi.fn(() =>
      Promise.resolve({
        id: "media-1",
        mediaType: "image",
        filePath: "remote/path.jpg",
      })
    ),
    getMediaContent: vi.fn(() =>
      Promise.resolve({
        buffer: new Uint8Array(MOCK_BUFFER_DATA),
      })
    ),
  },
}));

describe("TaggingService", () => {
  let taggingService: TaggingService;
  let mockAiClient: IAiClient;
  let mockSourceRepo: SourceRepository;
  let mockTagRepo: TagRepository;
  let mockCharacterRepo: CharacterRepository;
  let mockIpRepo: IIpRepository;

  beforeEach(() => {
    mockAiClient = {
      healthCheck: vi.fn(() => Promise.resolve(true)),
      tagImage: vi.fn(),
      tagImageByPath: vi.fn(),
      extractCcipFeature: vi.fn(),
      extractCcipFeatureByPath: vi.fn(),
      calculateCcipDifference: vi.fn(),
    } as unknown as IAiClient;

    mockSourceRepo = {
      findById: vi.fn((id: string) =>
        Promise.resolve({
          id,
          type: "s3", // remote source to trigger buffer flow
          connectionInfo: {},
        })
      ),
    } as unknown as SourceRepository;

    mockTagRepo = {
      findByMediaId: vi.fn(() => Promise.resolve([])),
      addTagsToMedia: vi.fn(() => Promise.resolve()),
    } as unknown as TagRepository;

    mockIpRepo = {
      findByName: vi.fn((name: string) =>
        Promise.resolve(
          name === "ExistingIP" ? { id: "ip-1", name: "ExistingIP" } : null
        )
      ),
      create: vi.fn((data: { name: string }) =>
        Promise.resolve({ id: "ip-new", name: data.name })
      ),
      addMediaBulk: vi.fn(() => Promise.resolve()),
      getMediaIps: vi.fn(() => Promise.resolve([])),
    } as unknown as IIpRepository;

    mockCharacterRepo = {
      findByName: vi.fn(() => Promise.resolve(null)),
      create: vi.fn((data: { name: string; ipId?: string }) =>
        Promise.resolve({ id: "char-new", name: data.name, ipId: data.ipId })
      ),
      update: vi.fn(() => Promise.resolve()),
      addToMediaBulk: vi.fn(() => Promise.resolve()),
      getMediaCharacters: vi.fn(() => Promise.resolve([])),
    } as unknown as CharacterRepository;

    taggingService = new TaggingService(
      mockAiClient,
      mockSourceRepo,
      mockTagRepo,
      mockCharacterRepo,
      mockIpRepo
    );
  });

  it("should correctly link characters to IPs based on ips_mapping", async () => {
    // Setup AI response with character -> ip mapping
    (mockAiClient.tagImage as any).mockResolvedValue({
      general: { "1girl": 0.9 },

      character: { HatsuneMiku: 0.95 },
      ips: ["Vocaloid"],

      ips_mapping: {
        // Character Name -> List of IP Names

        HatsuneMiku: ["Vocaloid"],
      },
    });

    // Mock IP repo to return an IP for "Vocaloid"
    (mockIpRepo.findByName as any).mockImplementation((name: string) => {
      if (name === "Vocaloid") {
        return Promise.resolve({ id: "ip-vocaloid", name: "Vocaloid" });
      }
      return Promise.resolve(null);
    });

    await taggingService.getTagsForMedia("source-1", "media-1");

    // Verify IP was looked up/created and linked to media
    expect(mockIpRepo.addMediaBulk).toHaveBeenCalledWith(
      "media-1",
      expect.arrayContaining([expect.objectContaining({ id: "ip-vocaloid" })]),
      "AI"
    );

    // Verify character creation included the ipIds
    expect(mockCharacterRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "HatsuneMiku",
        ipIds: ["ip-vocaloid"], // Crucial: Character should be linked to IP
        source: "AI",
      })
    );

    // Verify character was linked to media
    expect(mockCharacterRepo.addToMediaBulk).toHaveBeenCalledWith(
      "media-1",
      expect.arrayContaining([
        expect.objectContaining({ id: "char-new", confidence: 0.95 }),
      ]),
      "AI"
    );
  });
});
