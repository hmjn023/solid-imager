import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { upsertAuthor } from "~/infrastructure/db/queries/authors";
import {
  insertMediaAuthor,
  selectAuthorsByMediaId,
} from "~/infrastructure/db/queries/media-authors";
import {
  insertMediaUrls,
  selectMediaUrlsByMediaId,
} from "~/infrastructure/db/queries/media-urls";
import {
  authors,
  mediaAuthors,
  mediaSources,
  medias,
  mediaUrls,
} from "~/infrastructure/db/schema";

describe("Author and URL Integration", () => {
  const testSourceId = "b0eebc99-9c0b-4ef8-bb6d-6bb9bd380a99";
  let testMediaId: string;

  beforeAll(async () => {
    // Clean up
    await db.delete(mediaAuthors);
    await db.delete(mediaUrls);
    await db.delete(authors);
    await db.delete(medias);
    await db.delete(mediaSources);

    // Setup source
    await db.insert(mediaSources).values({
      id: testSourceId,
      name: "Test Source",
      type: "local",
      connectionInfo: { path: "/media/test" },
    });

    // Setup media
    const inserted = await db
      .insert(medias)
      .values({
        mediaSourceId: testSourceId,
        filePath: "/media/test/author-test.jpg",
        fileName: "author-test.jpg",
        mediaType: "image",
        width: 100,
        height: 100,
      })
      .returning();
    testMediaId = inserted[0].id;
  });

  afterAll(async () => {
    await db.delete(mediaAuthors);
    await db.delete(mediaUrls);
    await db.delete(authors);
    await db.delete(medias);
    await db.delete(mediaSources);
  });

  it("should upsert author correctly", async () => {
    const author1 = await upsertAuthor({
      name: "Test Artist",
      accountId: "test_artist_x",
    });
    expect(author1.id).toBeDefined();
    expect(author1.name).toBe("Test Artist");

    // Upsert same accountId, should return existing
    const author2 = await upsertAuthor({
      name: "Test Artist Changed",
      accountId: "test_artist_x",
    });
    expect(author2.id).toBe(author1.id);
  });

  it("should link author to media", async () => {
    const author = await upsertAuthor({
      name: "Linked Artist",
      accountId: "linked_artist",
    });

    await insertMediaAuthor(testMediaId, author.id);

    const linkedAuthors = await selectAuthorsByMediaId(testMediaId);
    expect(linkedAuthors).toHaveLength(1);
    expect(linkedAuthors[0].name).toBe("Linked Artist");
  });

  it("should insert and retrieve media URLs", async () => {
    const urls = [
      "https://example.com/img1.jpg",
      "https://twitter.com/status/123",
    ];
    await insertMediaUrls(testMediaId, urls);

    const retrievedUrls = await selectMediaUrlsByMediaId(testMediaId);
    expect(retrievedUrls).toHaveLength(2);
    const urlStrings = retrievedUrls.map((u) => u.url).sort();
    expect(urlStrings).toEqual(urls.sort());
  });
});
