import { type Mock, beforeEach, describe, expect, it, vi } from "vitest";
import { NotFoundError, UnknownDbError } from "~/infrastructure/db/errors";
import { db } from "~/infrastructure/db/index"; // Import the mocked db
import { selectRandomMedia } from "~/infrastructure/db/queries/media-random";

describe("selectRandomMedia", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (db.select as Mock).mockClear();
    (db.insert as Mock).mockClear();
    (db.update as Mock).mockClear();
    (db.delete as Mock).mockClear();
    (db.query.mediaSources.findFirst as Mock).mockClear();
    (db.transaction as Mock).mockClear();
  });

  it("should return a random media item on success", async () => {
    const media1 = {
      id: "media1",
      mediaSourceId: "source1",
      createdAt: new Date(),
    };

    (db.select as Mock).mockReturnValue({
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
    (db.select as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // No media found
          }),
        }),
      }),
    });

    await expect(selectRandomMedia("source1")).rejects.toBeInstanceOf(
      NotFoundError
    );
    expect(db.select).toHaveBeenCalled();
  });

  it("should return UnknownDbError on failure", async () => {
    (db.select as Mock).mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockRejectedValue(new Error("DB error")),
          }),
        }),
      }),
    });

    await expect(selectRandomMedia("source1")).rejects.toBeInstanceOf(
      UnknownDbError
    );
    expect(db.select).toHaveBeenCalled();
  });
});
