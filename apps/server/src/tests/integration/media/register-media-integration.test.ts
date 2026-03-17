import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { services } from "~/application/registry";
import { MediaProcessingService } from "~/application/services/media-processing-service";
import { MediaService } from "~/application/services/media-service";

import { db } from "~/infrastructure/db/index";
import {
  type MediaSource,
  mediaSources,
  medias,
} from "~/infrastructure/db/schema";

const TEST_TIMEOUT = 15_000;

describe("registerExistingMedia Integration", () => {
  let mediaSource: MediaSource;
  const fixturesDir = "src/tests/fixtures";
  const testImageName = "test-register-image.png";
  let tempSourceDir: string;

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
      .insert(mediaSources)
      .values({
        name: "Test Register Source",
        type: "local",
        connectionInfo: { path: tempSourceDir },
      })
      .returning();
  });

  afterEach(async () => {
    await db.delete(mediaSources);
    await db.delete(medias);

    // Clean up temp directory
    if (tempSourceDir) {
      await fs.rm(tempSourceDir, {
        recursive: true,
        force: true,
      });
    }
  });

  it(
    "should register existing media files from the directory",
    async () => {
      await MediaService.registerExistingMedia(mediaSource.id, tempSourceDir);

      // Verify media was added to DB
      const ExpectedWidth = 100;
      const ExpectedHeight = 100;
      const mediaList = await MediaService.getAllMedia(mediaSource.id);
      expect(mediaList).toHaveLength(1);
      expect(mediaList[0].fileName).toBe(testImageName);
      expect(mediaList[0].width).toBe(ExpectedWidth);
      expect(mediaList[0].height).toBe(ExpectedHeight);

      // Manually trigger background processing instead of waiting for worker
      const jobRepo = services.getJobRepository();
      const jobs = await jobRepo.findPending(10);
      const processJob = jobs.find((j) => j.type === "processMedia");
      if (processJob) {
        await MediaProcessingService.executeProcessMediaJob(processJob);
      }

      // Verify thumbnail generation
      const storageConfig = services.getConfigService().getConfig().storage;
      const thumbnailPath = path.join(
        storageConfig.thumbnailDir,
        mediaSource.id,
        `${mediaList[0].id}.webp`
      );

      // Should exist immediately after manual processing
      await fs.access(thumbnailPath);
    },
    TEST_TIMEOUT
  );

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
