import { beforeEach, describe, expect, it, vi } from "vitest";
import * as mediaSources from "~/infrastructure/db/media-sources";
import { selectMediaSources } from "~/infrastructure/db/media-sources";

describe("selectMediaSources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return an empty array on success", async () => {
    const mockDb = {
      select: vi.fn().mockReturnValue({
        from: vi.fn().mockResolvedValueOnce([]),
      }),
    };
    vi.spyOn(mediaSources, "selectMediaSources").mockImplementation(async () =>
      mockDb.select().from()
    );

    const result = await selectMediaSources();
    expect(result).toEqual([]);
    expect(mockDb.select).toHaveBeenCalled();
  });
});
