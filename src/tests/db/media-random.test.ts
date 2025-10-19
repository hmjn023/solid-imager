import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, UnknownDbError } from "~/infrastructure/db/errors";
import { selectRandomMedia } from "~/infrastructure/db/media-random";
import { db } from "~/tests/setup"; // Import the mocked db

describe("selectRandomMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as vi.Mock).mockClear();
    (db.insert as vi.Mock).mockClear();
    (db.update as vi.Mock).mockClear();
    (db.delete as vi.Mock).mockClear();
    (db.query.mediaSources.findFirst as vi.Mock).mockClear();
    (db.transaction as vi.Mock).mockClear();
  });

  it("should return a random media item on success", async () => {
    const media1 = { id: "media1", sourceId: "source1", createdAt: new Date() };
    
    (db.select as vi.Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([media1]),
          }),
        }),
      }),
    });

    const result = await selectRandomMedia("source1");
    expect(result).toEqual(media1);
    expect(db.select).toHaveBeenCalled();
  });

  it("should return NotFoundError if no random media found", async () => {
    (db.select as vi.Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No media found
          }),
        }),
      }),
    });

    await expect(selectRandomMedia("source1")).rejects.toBeInstanceOf(NotFoundError);
    expect(db.select).toHaveBeenCalled();
  });

  it("should return UnknownDbError on failure", async () => {
    (db.select as vi.Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("DB error")),
          }),
        }),
      }),
    });

    await expect(selectRandomMedia("source1")).rejects.toBeInstanceOf(UnknownDbError);
    expect(db.select).toHaveBeenCalled();
  });
});
