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
import { POST as copyPost } from "~/routes/api/sources/[mediaSourceId]/[mediaId]/copy";
import { POST as movePost } from "~/routes/api/sources/[mediaSourceId]/[mediaId]/move";

// Mock background jobs to prevent test hangs/timeouts
vi.mock("~/infrastructure/jobs/job-manager", () => ({
  addJobsToQueue: vi.fn(),
  startJobQueue: vi.fn(),
  resetJobQueue: vi.fn(),
}));

vi.mock("~/infrastructure/jobs/sse-manager", () => ({
  // biome-ignore lint/style/useNamingConvention: Mocking singleton object
  SseManager: {
    notifyMediaCopied: vi.fn(),
    notifyMediaMoved: vi.fn(),
    sendEvent: vi.fn(),
  },
}));

// Mocks are handled in setup-integration.ts
let migrate: any, schema: any;
let db: any;

describe("Media Copy/Move Integration", () => {
  let sourceA: any;
  let sourceB: any;
  let media1: any;
  const fixturesDir = "src/tests/fixtures";
  const testImageName = "test-image-with-metadata.png"; // Ensure this exists or use a dummy file creation
  let tempSourceDirA: string;
  let tempSourceDirB: string;

  beforeAll(async () => {
    const migratorModule = await import("drizzle-orm/pglite/migrator");
    migrate = migratorModule.migrate;
    schema = await import("~/infrastructure/db/schema");

    // Get DB instance
    const dbModule = await import("~/infrastructure/db/index");
    db = dbModule.db;

    // Ensure clean state by resetting schema
    try {
      await db.execute("DROP SCHEMA IF EXISTS drizzle CASCADE;");
      await db.execute("DROP SCHEMA IF EXISTS public CASCADE;");
      await db.execute("DROP TYPE IF EXISTS public.job_status CASCADE;");
      await db.execute("CREATE SCHEMA public;");
    } catch (e) {
      console.error("Cleanup error:", e);
    }

    try {
      await migrate(db, {
        migrationsFolder: "drizzle",
      });
    } catch (e) {
      console.error("Migration error:", e);
      throw e;
    }

    // Debug: Check if tables exist
    try {
      await db.execute(
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';"
      );
    } catch (e) {
      console.error("Error listing tables:", e);
    }
  });

  beforeEach(async () => {
    // Setup temp directories
    tempSourceDirA = await fs.mkdtemp(path.join(fixturesDir, "test-source-a-"));
    tempSourceDirB = await fs.mkdtemp(path.join(fixturesDir, "test-source-b-"));

    // Create a dummy image file in Source A
    const sourceFilePath = path.join(tempSourceDirA, "image1.png");
    try {
      await fs.copyFile(path.join(fixturesDir, testImageName), sourceFilePath);
    } catch {
      await fs.writeFile(sourceFilePath, Buffer.from("dummy content"));
    }

    // Insert media sources
    [sourceA] = await db
      .insert(schema.mediaSources)
      .values({
        name: "Source A",
        type: "local",
        connectionInfo: { path: tempSourceDirA },
      })
      .returning();

    [sourceB] = await db
      .insert(schema.mediaSources)
      .values({
        name: "Source B",
        type: "local",
        connectionInfo: { path: tempSourceDirB },
      })
      .returning();

    // Insert media record
    [media1] = await db
      .insert(schema.medias)
      .values({
        mediaSourceId: sourceA.id,
        filePath: "image1.png",
        fileName: "image1.png",
        mediaType: "image",
        width: 100,
        height: 100,
        fileSize: 1000,
      })
      .returning();
  });

  afterEach(async () => {
    try {
      await db.delete(schema.mediaSources);
      await db.delete(schema.medias);
    } catch (e) {
      console.error("Cleanup DB error:", e);
    }

    // Clean up temp directories
    if (tempSourceDirA) {
      await fs.rm(tempSourceDirA, { recursive: true, force: true });
    }
    if (tempSourceDirB) {
      await fs.rm(tempSourceDirB, { recursive: true, force: true });
    }
  });

  it("should copy media from Source A to Source B", async () => {
    const request = new Request("http://localhost/request", {
      method: "POST",
      body: JSON.stringify({ targetSourceId: sourceB.id }),
    });

    const event = {
      params: { mediaSourceId: sourceA.id, mediaId: media1.id },
      request,
    } as any;

    const response = await copyPost(event);
    // biome-ignore lint/style/noMagicNumbers: HTTP Success
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);
    expect(result.media).toBeDefined();

    // Verify DB
    const mediaInB = await db.query.medias.findFirst({
      where: (medias: any, { eq }: any) => eq(medias.mediaSourceId, sourceB.id),
    });
    expect(mediaInB).toBeDefined();
    expect(mediaInB.fileName).toBe("image1.png");

    // Verify Files
    const fileExistsInA = await fs
      .stat(path.join(tempSourceDirA, "image1.png"))
      .then(() => true)
      .catch(() => false);
    const fileExistsInB = await fs
      .stat(path.join(tempSourceDirB, "image1.png"))
      .then(() => true)
      .catch(() => false);

    expect(fileExistsInA).toBe(true);
    expect(fileExistsInB).toBe(true);
  });

  it("should move media from Source A to Source B", async () => {
    const request = new Request("http://localhost/request", {
      method: "POST",
      body: JSON.stringify({ targetSourceId: sourceB.id }),
    });

    const event = {
      params: { mediaSourceId: sourceA.id, mediaId: media1.id },
      request,
    } as any;

    const response = await movePost(event);
    // biome-ignore lint/style/noMagicNumbers: HTTP Success
    expect(response.status).toBe(200);

    const result = await response.json();
    expect(result.success).toBe(true);

    // Verify DB
    const mediaInA = await db.query.medias.findFirst({
      where: (medias: any, { eq }: any) => eq(medias.mediaSourceId, sourceA.id),
    });
    expect(mediaInA).toBeUndefined();

    const mediaInB = await db.query.medias.findFirst({
      where: (medias: any, { eq }: any) => eq(medias.mediaSourceId, sourceB.id),
    });
    expect(mediaInB).toBeDefined();

    // Verify Files
    const fileExistsInA = await fs
      .stat(path.join(tempSourceDirA, "image1.png"))
      .then(() => true)
      .catch(() => false);
    const fileExistsInB = await fs
      .stat(path.join(tempSourceDirB, "image1.png"))
      .then(() => true)
      .catch(() => false);

    expect(fileExistsInA).toBe(false);
    expect(fileExistsInB).toBe(true);
  });
});
