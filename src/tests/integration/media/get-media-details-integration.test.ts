import fs from "node:fs/promises";
import path from "node:path";
// This import is hoisted, so we need to be careful
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { MediaService } from "~/application/services/media-service";

// We need to dynamically import these to work around Vitest's hoisting
let _PGlite: any, drizzle: any, migrate: any, schema: any, _eq: any;
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

describe("getMediaDetails", () => {
  let mediaSource: MediaSource;
  let media: Media;
  const fixturesDir = "src/tests/fixtures";
  const testImageName = "test-image-with-metadata.png";

  beforeAll(async () => {
    // Dynamically import dependencies
    const pgliteModule = await import("@electric-sql/pglite");
    _PGlite = pgliteModule.PGlite;
    const drizzleOrmModule = await import("drizzle-orm/pglite");
    drizzle = drizzleOrmModule.drizzle;
    const drizzleOrm = await import("drizzle-orm");
    _eq = drizzleOrm.eq;
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

    // Pre-insert generation info to avoid testing the extraction logic here
    await db.insert(schema.mediaGenerationInfo).values({
      mediaId: media.id,
      prompt: JSON.stringify({ prompt: "test prompt" }),
    });
    const [tag] = await db
      .insert(schema.tags)
      .values({ name: "positive prompt" })
      .returning();
    await db.insert(schema.mediaTags).values({
      mediaId: media.id,
      tagId: tag.id,
      tagType: "positive",
    });
  });

  afterEach(async () => {
    await db.delete(schema.mediaSources);
    await db.delete(schema.medias);
    await db.delete(schema.mediaGenerationInfo);
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

  it("should return full media details including tags and generation info", async () => {
    const details = await MediaService.getMediaDetails(
      mediaSource.id,
      media.id
    );

    // Verify the details object is correct
    expect(details).toBeDefined();
    expect(details.id).toBe(media.id);

    // Verify generation info
    expect(details.generationInfo).not.toBeNull();
    const parsedPrompt = JSON.parse(details.generationInfo.prompt);
    expect(parsedPrompt.prompt).toBe("test prompt");

    // Verify tags
    expect(details.tags).toBeDefined();
    expect(details.tags).toHaveLength(1);
    expect(details.tags[0].name).toBe("positive prompt");
    expect(details.tags[0].type).toBe("positive");
  });
});
