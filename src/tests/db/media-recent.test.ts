import { beforeEach, describe, expect, it, vi } from "vitest";
import { UnknownDbError } from "~/infrastructure/db/errors";
import { db } from "~/infrastructure/db/index"; // Import the mocked db
import { selectRecentMedia } from "~/infrastructure/db/queries/media-recent";

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
    (db.select as vi.Mock).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce([media1]),
    });
    const result = await selectRecentMedia("source1", 1);
    expect(result).toEqual([media1]);
    expect(db.select).toHaveBeenCalled();
  });

  it("should return an empty array if no recent media found", async () => {
    (db.select as vi.Mock).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValueOnce([]),
    });
    const result = await selectRecentMedia("source1", 1);
    expect(result).toEqual([]);
    expect(db.select).toHaveBeenCalled();
  });

  it("should return UnknownDbError on failure", async () => {
    (db.select as vi.Mock).mockReturnValue({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi
        .fn()
        .mockRejectedValueOnce(new UnknownDbError({ message: "DB error" })),
    });
    await expect(selectRecentMedia("source1", 1)).rejects.toBeInstanceOf(
      UnknownDbError
    );
    expect(db.select).toHaveBeenCalled();
  });
});
