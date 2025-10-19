import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  selectMediaGenerationInfoById,
  updateMediaGenerationInfo,
} from "~/infrastructure/db/queries/media-generation-info";
import {
  mediaGenerationInfo,
  mediaSources,
  medias,
  type NewMedia,
  type NewMediaGenerationInfo,
} from "~/infrastructure/db/schema";

describe("media-generation-info queries Integration", () => {
  let testMediaId: string;

  beforeAll(async () => {
    await db.delete(mediaGenerationInfo).where(sql`true`);
    await db.delete(medias).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);

    const source = await db
      .insert(mediaSources)
      .values({
        name: "gen-info-test",
        type: "local",
        connectionInfo: { path: "/" },
      })
      .returning();
    const media: NewMedia = {
      sourceId: source[0].id,
      filePath: "a",
      fileName: "a",
      mediaType: "image",
      width: 1,
      height: 1,
    };
    const insertedMedia = await db.insert(medias).values(media).returning();
    testMediaId = insertedMedia[0].id;

    const genInfo: NewMediaGenerationInfo = {
      mediaId: testMediaId,
      metadata: { prompt: "test" },
    };
    await db.insert(mediaGenerationInfo).values(genInfo);
  });

  afterAll(async () => {
    await db.delete(mediaGenerationInfo).where(sql`true`);
    await db.delete(medias).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);
  });

  it("should select media generation info by media ID", async () => {
    const info = await selectMediaGenerationInfoById(testMediaId);
    expect(info).toBeDefined();
    expect(info.mediaId).toBe(testMediaId);
    expect(info.metadata).toEqual({ prompt: "test" });
  });

  it("should throw NotFoundError for non-existent media ID", async () => {
    const nonExistentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a55";
    await expect(selectMediaGenerationInfoById(nonExistentId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("should update media generation info", async () => {
    const updatedMetadata = { prompt: "updated test" };
    const updated = await updateMediaGenerationInfo(
      testMediaId,
      updatedMetadata
    );
    expect(updated).toBeDefined();
    expect(updated.metadata).toEqual(updatedMetadata);

    const selected = await selectMediaGenerationInfoById(testMediaId);
    expect(selected.metadata).toEqual(updatedMetadata);
  });
});
