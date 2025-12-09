import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  selectMediaGenerationInfoById,
  updateMediaGenerationInfo,
  upsertMediaGenerationInfo,
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
    await db.delete(mediaGenerationInfo);
    await db.delete(medias);
    await db.delete(mediaSources);

    const source = await db
      .insert(mediaSources)
      .values({
        name: "gen-info-test",
        type: "local",
        connectionInfo: { path: "/" },
      })
      .returning();
    const media: NewMedia = {
      mediaSourceId: source[0].id,
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
    await db.delete(mediaGenerationInfo);
    await db.delete(medias);
    await db.delete(mediaSources);
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

  it("should insert new media generation info if it does not exist", async () => {
    const newMediaId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a56";
    const newPrompt = "new prompt";
    const newWorkflow = { nodes: [] };

    const source = await db
      .insert(mediaSources)
      .values({
        name: "gen-info-test-new-media",
        type: "local",
        connectionInfo: { path: "/new" },
      })
      .returning();
    const media: NewMedia = {
      mediaSourceId: source[0].id,
      filePath: "b",
      fileName: "b",
      mediaType: "image",
      width: 1,
      height: 1,
      id: newMediaId,
    };
    await db.insert(medias).values(media);

    const inserted = await upsertMediaGenerationInfo(
      newMediaId,
      newPrompt,
      newWorkflow
    );

    expect(inserted).toBeDefined();
    expect(inserted.mediaId).toBe(newMediaId);
    expect(inserted.prompt).toBe(newPrompt);
    expect(inserted.workflow).toEqual(newWorkflow);

    const selected = await selectMediaGenerationInfoById(newMediaId);
    expect(selected.prompt).toBe(newPrompt);
    expect(selected.workflow).toEqual(newWorkflow);
  });

  it("should update existing media generation info if it exists", async () => {
    const existingMediaId = testMediaId;
    const updatedPrompt = "updated prompt for existing";
    const updatedWorkflow = { nodes: [{ type: "updated" }] };

    const updated = await upsertMediaGenerationInfo(
      existingMediaId,
      updatedPrompt,
      updatedWorkflow
    );

    expect(updated).toBeDefined();
    expect(updated.mediaId).toBe(existingMediaId);
    expect(updated.prompt).toBe(updatedPrompt);
    expect(updated.workflow).toEqual(updatedWorkflow);

    const selected = await selectMediaGenerationInfoById(existingMediaId);
    expect(selected.prompt).toBe(updatedPrompt);
    expect(selected.workflow).toEqual(updatedWorkflow);
  });
});
