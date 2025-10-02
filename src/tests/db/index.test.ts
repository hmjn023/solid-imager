import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { db, pool } from "~/db";
import {
  insertMediaSource,
  selectMediaSourceById,
  selectMediaSources,
  updateMediaSource,
} from "~/db/index";
import type { NewMediaSource } from "~/db/schema";
import { mediaSources } from "~/db/schema";

describe("Media Source Database Operations", () => {
  beforeAll(async () => {
    await db.delete(mediaSources);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    await db.delete(mediaSources);
  });

  it("should insert a new media source and select it", async () => {
    const newMediaSource: NewMediaSource = {
      name: "Test Source",
      description: "A test media source",
      type: "local",
      connectionInfo: { path: "/test/path" },
    };

    const inserted = await insertMediaSource(newMediaSource);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].name).toBe(newMediaSource.name);

    const allSources = await selectMediaSources();
    expect(allSources).toHaveLength(1);
    expect(allSources[0].name).toBe(newMediaSource.name);

    const selectedById = await selectMediaSourceById(inserted[0].id);
    expect(selectedById).toHaveLength(1);
    expect(selectedById[0].name).toBe(newMediaSource.name);
  });

  it("should update a media source", async () => {
    const newMediaSource: NewMediaSource = {
      name: "Test Source for Update",
      description: "A test media source to be updated",
      type: "local",
      connectionInfo: { path: "/test/path/update" },
    };

    const [inserted] = await insertMediaSource(newMediaSource);

    const updatedData = {
      ...inserted,
      name: "Updated Test Source",
    };

    const [updated] = await updateMediaSource(inserted.id, updatedData);
    expect(updated.name).toBe(updatedData.name);

    const [selected] = await selectMediaSourceById(inserted.id);
    expect(selected.name).toBe(updatedData.name);
  });

  // it("メディアソースを削除するべき", async () => {
  // 	const newMediaSource: NewMediaSource = {
  // 		name: "Test Source for Deletion",
  // 		description: "A test media source to be deleted",
  // 		type: "local",
  // 		connectionInfo: { path: "/test/path/delete" },
  // 	};

  // 	const [inserted] = await insertMediaSource(newMediaSource);

  // 	const [deleted] = await deleteMediaSource(inserted.id);
  // 	expect(deleted.id).toBe(inserted.id);

  // 	const allSources = await selectMediaSources();
  // 	expect(allSources).toHaveLength(0);
  // });
});
