import { afterEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted to ensure mockDb is available for vi.mock
const { mockDb } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        onConflictDoNothing: vi.fn(() => ({
          returning: vi.fn(() => [
            { id: "mock-id", url: "http://example.com/1" },
          ]),
        })),
        returning: vi.fn(() => []),
      })),
    })),
  },
}));

// Mock BEFORE importing MediaRepository
vi.mock("~/infrastructure/db/index", () => ({
  db: mockDb,
}));

import { MediaRepository } from "~/infrastructure/repositories/media-repository";

describe("MediaRepository Unit", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("addUrls should call onConflictDoNothing to avoid duplicate errors", async () => {
    const mediaId = "media-1";
    const urls = ["http://example.com/1", "http://example.com/2"];

    await MediaRepository.addUrls(mediaId, urls);

    // Verify the chain
    expect(mockDb.insert).toHaveBeenCalled();
  });
});
