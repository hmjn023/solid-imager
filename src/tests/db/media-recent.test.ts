import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnknownDbError } from "~/infrastructure/db/errors";
import * as mediaRecent from "~/infrastructure/db/media-recent";
import { db } from "~/tests/setup"; // Import the mocked db

describe("selectRecentMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as vi.Mock).mockClear();
    (db.insert as vi.Mock).mockClear();
    (db.update as vi.Mock).mockClear();
    (db.delete as vi.Mock).mockClear();
    (db.query.mediaSources.findFirst as vi.Mock).mockClear();
    (db.transaction as vi.Mock).mockClear();
  });

  it("should return a list of recent media on success", async () => {
    const media1 = { id: "media1", sourceId: "source1", createdAt: new Date() };
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([media1]),
      }),
    };
    vi.spyOn(mediaRecent, "selectRecentMedia").mockImplementation(
      async (_sourceId, _limit) =>
        mockDb.select().from().where().orderBy().limit()
    );
    const result = await mediaRecent.selectRecentMedia("source1", 1);
    expect(result).toEqual([media1]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("should return an empty array if no recent media found", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValueOnce([]),
      }),
    };
    vi.spyOn(mediaRecent, "selectRecentMedia").mockImplementation(
      async (_sourceId, _limit) =>
        mockDb.select().from().where().orderBy().limit()
    );
    const result = await mediaRecent.selectRecentMedia("source1", 1);
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });

  it("should return UnknownDbError on failure", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        limit: vi
          .fn()
          .mockRejectedValueOnce(new UnknownDbError({ message: "DB error" })),
      }),
    };
    vi.spyOn(mediaRecent, "selectRecentMedia").mockImplementation(
      async (_sourceId, _limit) =>
        mockDb.select().from().where().orderBy().limit()
    );
    await expect(
      mediaRecent.selectRecentMedia("source1", 1)
    ).rejects.toBeInstanceOf(UnknownDbError);
    expect(mockDb.select).toHaveBeenCalled();
  });
});
