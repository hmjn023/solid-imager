import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { MediaService } from "~/application/services/media-service";

// Mocks are handled in setup-integration.ts
let migrate: any;
let schema: any;
let db: any;

import type { MediaSource } from "~/infrastructure/db/schema";

describe("registerExistingMedia Integration", () => {
  let mediaSource: MediaSource;
  const fixturesDir = "src/tests/fixtures";
  const testImageName = "test-register-image.png";
  let tempSourceDir: string;

  beforeAll(async () => {
    // Import dependencies
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
    } catch (_e) {
      // Ignore
    }

    await migrate(db, {
      migrationsFolder: "drizzle",
    });
  });

  beforeEach(async () => {
    // Create a temporary directory for the media source
    tempSourceDir = await fs.mkdtemp(
      path.join(fixturesDir, "test-source-register-")
    );

    // Create a dummy image file
    const imagePath = path.join(tempSourceDir, testImageName);
    await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toFile(imagePath);

    // Insert a media source
    [mediaSource] = await db
      .insert(schema.mediaSources)
      .values({
        name: "Test Register Source",
        type: "local",
        connectionInfo: { path: tempSourceDir },
      })
      .returning();
  });

  afterEach(async () => {
    await db.delete(schema.mediaSources);
    await db.delete(schema.medias);

    // Clean up temp directory
    if (tempSourceDir) {
      await fs.rm(tempSourceDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it("should register existing media files from the directory", async () => {
    await MediaService.registerExistingMedia(mediaSource.id, tempSourceDir);

    // Verify media was added to DB
    const ExpectedWidth = 100;
    const ExpectedHeight = 100;
    const mediaList = await MediaService.getAllMedia(mediaSource.id);
    expect(mediaList).toHaveLength(1);
    expect(mediaList[0].fileName).toBe(testImageName);
    expect(mediaList[0].width).toBe(ExpectedWidth);
    expect(mediaList[0].height).toBe(ExpectedHeight);

    // Verify thumbnail generation (wait for background job)
    const thumbnailPath = path.join(
      ".cache/thumbnails",
      mediaSource.id,
      `${mediaList[0].id}.webp`
    );

    // Poll for thumbnail existence
    let thumbnailExists = false;
    const MaxRetries = 20;
    const RetryIntervalMs = 100;
    for (let i = 0; i < MaxRetries; i++) {
      try {
        await fs.access(thumbnailPath);
        thumbnailExists = true;
        break;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, RetryIntervalMs));
      }
    }
    expect(thumbnailExists).toBe(true);
  });

  it("should not register duplicate media files", async () => {
    // First registration
    await MediaService.registerExistingMedia(mediaSource.id, tempSourceDir);

    // Second registration
    await MediaService.registerExistingMedia(mediaSource.id, tempSourceDir);

    // Verify no duplicates
    const mediaList = await MediaService.getAllMedia(mediaSource.id);
    expect(mediaList).toHaveLength(1);
  });
});
