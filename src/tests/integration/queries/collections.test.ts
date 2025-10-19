import { sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  deleteCollection,
  deleteCollectionMedia,
  insertCollection,
  insertCollectionMedia,
  selectCollectionById,
  selectCollections,
  updateCollection,
} from "~/infrastructure/db/queries/collections";
import {
  collectionMedia,
  collections,
  mediaSources,
  medias,
  type NewCollection,
  type NewMedia,
  type NewUser,
  users,
} from "~/infrastructure/db/schema";

describe("collections queries Integration", () => {
  let testUserId: string;
  let testCollectionId: string;
  let testMediaId: string;

  beforeAll(async () => {
    await db.delete(collectionMedia).where(sql`true`);
    await db.delete(collections).where(sql`true`);
    await db.delete(medias).where(sql`true`);
    await db.delete(users).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);

    const testUser: NewUser = {
      name: "CollTestUser",
      email: "coll@test.com",
      password: "pw",
    };
    const insertedUser = await db.insert(users).values(testUser).returning();
    testUserId = insertedUser[0].id;

    const testSource = await db
      .insert(mediaSources)
      .values({
        name: "coll-test-source",
        type: "local",
        connectionInfo: { path: "/" },
      })
      .returning();

    const testMedia: NewMedia = {
      sourceId: testSource[0].id,
      filePath: "a",
      fileName: "a",
      mediaType: "image",
      width: 1,
      height: 1,
    };
    const insertedMedia = await db.insert(medias).values(testMedia).returning();
    testMediaId = insertedMedia[0].id;

    const initialCollection: NewCollection = {
      name: "Initial Collection",
      userId: testUserId,
    };
    const inserted = await db
      .insert(collections)
      .values(initialCollection)
      .returning();
    testCollectionId = inserted[0].id;
  });

  afterAll(async () => {
    await db.delete(collectionMedia).where(sql`true`);
    await db.delete(collections).where(sql`true`);
    await db.delete(medias).where(sql`true`);
    await db.delete(users).where(sql`true`);
    await db.delete(mediaSources).where(sql`true`);
  });

  it("should select all collections", async () => {
    const result = await selectCollections();
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should select a collection by its ID", async () => {
    const collection = await selectCollectionById(testCollectionId);
    expect(collection).toBeDefined();
    expect(collection.id).toBe(testCollectionId);
  });

  it("should insert a new collection", async () => {
    const newCollection: NewCollection = {
      name: "New Test Collection",
      userId: testUserId,
    };
    const inserted = await insertCollection(newCollection);
    expect(inserted).toBeDefined();
    expect(inserted[0].name).toBe(newCollection.name);
    await deleteCollection(inserted[0].id);
  });

  it("should update an existing collection", async () => {
    const updatedName = "Updated Collection Name";
    const updated = await updateCollection(testCollectionId, {
      name: updatedName,
    });
    expect(updated).toBeDefined();
    expect(updated.name).toBe(updatedName);
  });

  it("should add and remove media from a collection", async () => {
    await insertCollectionMedia(testCollectionId, testMediaId);
    let mediaInCollection = await db
      .select()
      .from(collectionMedia)
      .where(sql`collection_id = ${testCollectionId}`);
    expect(mediaInCollection.length).toBe(1);

    await deleteCollectionMedia(testCollectionId, testMediaId);
    mediaInCollection = await db
      .select()
      .from(collectionMedia)
      .where(sql`collection_id = ${testCollectionId}`);
    expect(mediaInCollection.length).toBe(0);
  });

  it("should delete a collection", async () => {
    const collectionToDelete: NewCollection = {
      name: "Delete Me",
      userId: testUserId,
    };
    const inserted = await insertCollection(collectionToDelete);
    const insertedId = inserted[0].id;

    await deleteCollection(insertedId);

    await expect(selectCollectionById(insertedId)).rejects.toThrow(
      NotFoundError
    );
  });
});
