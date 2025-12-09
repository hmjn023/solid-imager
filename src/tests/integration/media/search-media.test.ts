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
import { GET } from "~/routes/api/sources/[mediaSourceId]/search";

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

describe("GET /api/sources/:mediaSourceId/search", () => {
  let mediaSource: any;
  let media1: any;
  let media2: any;
  let media3: any;
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

    // Insert media records
    [media1] = await db
      .insert(schema.medias)
      .values({
        mediaSourceId: mediaSource.id,
        filePath: "image1.png",
        fileName: "image1.png",
        mediaType: "image",
        width: 100,
        height: 100,
        fileSize: 1000,
      })
      .returning();

    [media2] = await db
      .insert(schema.medias)
      .values({
        mediaSourceId: mediaSource.id,
        filePath: "image2.png",
        fileName: "image2.png",
        mediaType: "image",
        width: 200,
        height: 200,
        fileSize: 2000,
      })
      .returning();

    [media3] = await db
      .insert(schema.medias)
      .values({
        mediaSourceId: mediaSource.id,
        filePath: "image3.png",
        fileName: "image3.png",
        mediaType: "image",
        width: 300,
        height: 300,
        fileSize: 3000,
      })
      .returning();

    // Insert tags
    const [tag1] = await db
      .insert(schema.tags)
      .values({ name: "landscape" })
      .returning();
    const [tag2] = await db
      .insert(schema.tags)
      .values({ name: "portrait" })
      .returning();
    const [tag3] = await db
      .insert(schema.tags)
      .values({ name: "nsfw" })
      .returning();

    // Associate tags with media
    await db.insert(schema.mediaTags).values([
      { mediaId: media1.id, tagId: tag1.id, tagType: "positive" },
      { mediaId: media1.id, tagId: tag3.id, tagType: "positive" },
      { mediaId: media2.id, tagId: tag2.id, tagType: "positive" },
      { mediaId: media3.id, tagId: tag1.id, tagType: "positive" },
      { mediaId: media3.id, tagId: tag2.id, tagType: "positive" },
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

  it("should search media by single tag (OR mode)", async () => {
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/search?tags=landscape`
    );
    const event = {
      request,
      params: { mediaSourceId: mediaSource.id },
    } as any;

    const response = await GET(event);
    const HttpOk = 200;
    expect(response.status).toBe(HttpOk);

    const result = await response.json();
    expect(result.media).toHaveLength(2);
    expect(result.total).toBe(2);
    expect(result.media.map((m: any) => m.id)).toContain(media1.id);
    expect(result.media.map((m: any) => m.id)).toContain(media3.id);
  });

  it("should search media by multiple tags with OR mode", async () => {
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/search?tags=landscape,portrait&tagMode=or`
    );
    const event = {
      request,
      params: { mediaSourceId: mediaSource.id },
    } as any;

    const response = await GET(event);
    const HttpOk = 200;
    expect(response.status).toBe(HttpOk);

    const result = await response.json();
    const ExpectedMediaCountAll = 3;
    expect(result.media).toHaveLength(ExpectedMediaCountAll);
    expect(result.total).toBe(ExpectedMediaCountAll);
  });

  it("should search media by multiple tags with AND mode", async () => {
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/search?tags=landscape,portrait&tagMode=and`
    );
    const event = {
      request,
      params: { mediaSourceId: mediaSource.id },
    } as any;

    const response = await GET(event);
    const HttpOk = 200;
    expect(response.status).toBe(HttpOk);

    const result = await response.json();
    expect(result.media).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.media[0].id).toBe(media3.id);
  });

  it("should exclude tags from search results", async () => {
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/search?tags=landscape&excludeTags=nsfw`
    );
    const event = {
      request,
      params: { mediaSourceId: mediaSource.id },
    } as any;

    const response = await GET(event);
    const HttpOk = 200;
    expect(response.status).toBe(HttpOk);

    const result = await response.json();
    expect(result.media).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.media[0].id).toBe(media3.id);
  });

  it("should sort results by size", async () => {
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/search?sort=size&order=asc`
    );
    const event = {
      request,
      params: { mediaSourceId: mediaSource.id },
    } as any;

    const response = await GET(event);
    const HttpOk = 200;
    expect(response.status).toBe(HttpOk);

    const result = await response.json();
    const ExpectedMediaCountAll = 3;
    expect(result.media).toHaveLength(ExpectedMediaCountAll);
    expect(result.media[0].id).toBe(media1.id);
    expect(result.media[1].id).toBe(media2.id);
    expect(result.media[2].id).toBe(media3.id);
  });

  it("should paginate results", async () => {
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/search?limit=2&offset=1`
    );
    const event = {
      request,
      params: { mediaSourceId: mediaSource.id },
    } as any;

    const response = await GET(event);
    const HttpOk = 200;
    expect(response.status).toBe(HttpOk);

    const result = await response.json();
    expect(result.media).toHaveLength(2);
    const TotalMediaCount = 3;
    expect(result.total).toBe(TotalMediaCount);
  });

  it("should search by filename query", async () => {
    const request = new Request(
      `http://localhost/api/sources/${mediaSource.id}/search?q=image1`
    );
    const event = {
      request,
      params: { mediaSourceId: mediaSource.id },
    } as any;

    const response = await GET(event);
    const HttpOk = 200;
    expect(response.status).toBe(HttpOk);

    const result = await response.json();
    expect(result.media).toHaveLength(1);
    expect(result.media[0].id).toBe(media1.id);
  });
});
