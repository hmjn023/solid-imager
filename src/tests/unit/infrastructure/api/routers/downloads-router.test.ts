import { beforeEach, describe, expect, it, vi } from "vitest";
import { downloadsRouter } from "~/infrastructure/api/routers/downloads-router";
import { db } from "~/infrastructure/db";
import { jobs } from "~/infrastructure/db/schema";

vi.mock("~/infrastructure/db", () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn(() => ({
        returning: vi.fn(() => Promise.resolve([{ id: "new-job-id" }])),
      })),
    })),
  },
}));

describe("Downloads Router", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("preview", () => {
    it("should save import items as a pending_approval job", async () => {
      const input = {
        items: [
          { imageUrl: "https://example.com/image.jpg", description: "Test" },
        ],
      };

      // @ts-expect-error
      const result = await downloadsRouter.preview["~orpc"].handler({ input });

      expect(db.insert).toHaveBeenCalledWith(jobs);
      expect(result).toEqual({
        success: true,
        jobId: "new-job-id",
        message: "Import data saved for preview",
      });
    });
  });
});
