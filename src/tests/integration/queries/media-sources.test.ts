import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  deleteMediaSource,
  insertMediaSource,
  selectMediaSourceById,
  selectMediaSources,
  updateMediaSource,
} from "~/infrastructure/db/queries/media-sources";
import { mediaSources } from "~/infrastructure/db/schema";

describe("media-sources queries Integration", () => {
  const testSourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";
  const initialMediaSource = {
    id: testSourceId,
    name: "Initial Test Source",
    type: "local" as const,
    connectionInfo: { path: "/initial/path" },
  };

  beforeAll(async () => {
    // Clean up previous test data
    await db.delete(mediaSources);
    // Seed initial data
    await db.insert(mediaSources).values(initialMediaSource);
  });

  afterAll(async () => {
    // Clean up all data
    await db.delete(mediaSources);
  });

  it("should select all media sources", async () => {
    const sources = await selectMediaSources();
    expect(sources).toBeInstanceOf(Array);
    expect(sources.length).toBeGreaterThanOrEqual(1);
    expect(sources.some((s) => s.id === testSourceId)).toBe(true);
  });

  it("should select a media source by its ID", async () => {
    const source = await selectMediaSourceById(testSourceId);
    expect(source).toBeDefined();
    expect(source.id).toBe(testSourceId);
    expect(source.name).toBe(initialMediaSource.name);
  });

  it("should throw NotFoundError when selecting a non-existent media source ID", async () => {
    const nonExistentId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a22";
    await expect(selectMediaSourceById(nonExistentId)).rejects.toThrow(
      NotFoundError
    );
  });

  it("should insert a new media source", async () => {
    const newSource = {
      name: "New Test Source",
      type: "s3" as const,
      connectionInfo: { bucket: "test-bucket", region: "us-west-2" },
    };
    const inserted = await insertMediaSource(newSource);
    expect(inserted).toBeDefined();
    expect(inserted[0].name).toBe(newSource.name);

    // Verify it exists in the DB
    const selected = await selectMediaSourceById(inserted[0].id);
    expect(selected).toBeDefined();

    // Cleanup
    await deleteMediaSource(inserted[0].id);
  });

  it("should update an existing media source", async () => {
    const updatedName = "Updated Test Source Name";
    const sourceToUpdate = { ...initialMediaSource, name: updatedName };

    const updated = await updateMediaSource(testSourceId, sourceToUpdate);

    expect(updated).toBeDefined();
    expect(updated.name).toBe(updatedName);

    // Verify the change in the DB
    const selected = await selectMediaSourceById(testSourceId);
    expect(selected.name).toBe(updatedName);
  });

  it("should delete a media source", async () => {
    const sourceToDelete = {
      name: "To Be Deleted",
      type: "local" as const,
      connectionInfo: { path: "/delete/me" },
    };
    const inserted = await insertMediaSource(sourceToDelete);
    const insertedId = inserted[0].id;

    await deleteMediaSource(insertedId);

    // Verify it's gone
    await expect(selectMediaSourceById(insertedId)).rejects.toThrow(
      NotFoundError
    );
  });
});
