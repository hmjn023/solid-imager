import fs from "node:fs/promises";
import path from "node:path";
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { GET } from "~/routes/api/sources/[mediaSourceId]/[mediaId]/tags";

// We need to dynamically import these to work around Vitest's hoisting
let _PGlite: any, drizzle: any, migrate: any, schema: any;
let testDb: any, db: any;

vi.mock("~/infrastructure/db/index", async () => {
  const { PGlite: PgLiteClass } = await import("@electric-sql/pglite");
  const { drizzle: drizzleFunc } = await import("drizzle-orm/pglite");
  const schemaModule = await import("~/infrastructure/db/schema");

  const pg = new PgLiteClass();
  const dbInstance = drizzleFunc(pg, { schema: schemaModule });

  // Expose the testDb instance to the global scope for the test file
  global.vitestTestDb = pg;

  return { db: dbInstance };
});

describe("GET /api/sources/:mediaSourceId/:mediaId/tags", () => {
  let mediaSource: any;
  let media: any;
  const fixturesDir = "src/tests/fixtures";
  const testImageName = "test-image-with-metadata.png";

  beforeAll(async () => {
    // Dynamically import dependencies
    const pgliteModule = await import("@electric-sql/pglite");
    _PGlite = pgliteModule.PGlite;
    const drizzleOrmModule = await import("drizzle-orm/pglite");
    drizzle = drizzleOrmModule.drizzle;
    const migratorModule = await import("drizzle-orm/pglite/migrator");
    migrate = migratorModule.migrate;
    schema = await import("~/infrastructure/db/schema");

    testDb = global.vitestTestDb;
    db = drizzle(testDb, { schema });

    await migrate(db, {
      migrationsFolder: "drizzle",
    });
  });

  beforeEach(async () => {
    // Create a temporary directory for the media source
    const tempSourceDir = await fs.mkdtemp(
      path.join(fixturesDir, "test-source-")
    );
    await fs.copyFile(
      path.join(fixturesDir, testImageName),
      path.join(tempSourceDir, testImageName)
    );

    // Insert a media source
    [mediaSource] = await db
      .insert(schema.mediaSources)
      .values({
        name: "Test Source",
        type: "local",
        connectionInfo: { path: tempSourceDir },
      })
      .returning();

    // Insert a media record
    [media] = await db
      .insert(schema.medias)
      .values({
        mediaSourceId: mediaSource.id,
        filePath: testImageName,
        fileName: testImageName,
        mediaType: "image",
        width: 1,
        height: 1,
        fileSize: 1,
      })
      .returning();

    // Insert tags
    const [tag1] = await db
      .insert(schema.tags)
      .values({ name: "tag1" })
      .returning();
    const [tag2] = await db
      .insert(schema.tags)
      .values({ name: "tag2" })
      .returning();

    // Associate tags with media
    await db.insert(schema.mediaTags).values([
      {
        mediaId: media.id,
        tagId: tag1.id,
        tagType: "positive",
      },
      {
        mediaId: media.id,
        tagId: tag2.id,
        tagType: "negative",
      },
    ]);
  });

  afterEach(async () => {
    await db.delete(schema.mediaSources);
    await db.delete(schema.medias);
    await db.delete(schema.tags);
    await db.delete(schema.mediaTags);

    // Clean up temp directory
    if (mediaSource.connectionInfo && "path" in mediaSource.connectionInfo) {
      await fs.rm(mediaSource.connectionInfo.path, {
        recursive: true,
        force: true,
      });
    }
  });

  it("should return tags for the specified media", async () => {
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/${media.id}/tags`
    );
    const event = {
      request,
      params: {
        mediaSourceId: mediaSource.id,
        mediaId: media.id,
      },
    } as any;

    const response = await GET(event);
    const HttpOk = 200;
    expect(response.status).toBe(HttpOk);

    const tags = await response.json();
    expect(tags).toHaveLength(2);
    expect(tags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "tag1", type: "positive" }),
        expect.objectContaining({ name: "tag2", type: "negative" }),
      ])
    );
  });

  it("should return 404 if media is not found", async () => {
    const nonExistentMediaId = "00000000-0000-0000-0000-000000000000";
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/${nonExistentMediaId}/tags`
    );
    const event = {
      request,
      params: {
        mediaSourceId: mediaSource.id,
        mediaId: nonExistentMediaId,
      },
    } as any;

    const response = await GET(event);
    const HttpNotFound = 404;
    expect(response.status).toBe(HttpNotFound);
  });

  it("should return 400 for invalid UUID", async () => {
    const invalidId = "invalid-uuid";
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/${invalidId}/tags`
    );
    const event = {
      request,
      params: {
        mediaSourceId: mediaSource.id,
        mediaId: invalidId,
      },
    } as any;

    const response = await GET(event);
    const HttpBadRequest = 400;
    expect(response.status).toBe(HttpBadRequest);
  });
});
