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
import { MediaService } from "~/application/services/media-service";
import { taggingService } from "~/application/services/tagging-service";

// Mock LocalMediaStorage to avoid needing real media files (ffmpeg/sharp dependencies)
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

// biome-ignore lint/suspicious/noExplicitAny: Mocking
vi.spyOn(LocalMediaStorage, "getFileMetadata").mockImplementation(
  (filePath: string): Promise<any> => {
    const ext = path.extname(filePath).toLowerCase();

    if (
      [
        ".mp4",
        ".mp3",
        ".wav",
        ".jpg",
        ".m4a",
        ".ogg",
        ".webm",
        ".mov",
        ".mkv",
        ".avi",
      ].includes(ext)
    ) {
      return Promise.resolve({
        width: 100,
        height: 100,
        size: 1024,
        createdAt: new Date(),
        modifiedAt: new Date(),
        duration: 10,
      });
    }
    return Promise.resolve({
      width: 0,
      height: 0,
      size: 0,
      createdAt: new Date(),
      modifiedAt: new Date(),
    });
  }
);

// biome-ignore lint/suspicious/noExplicitAny: Mock types
let migrate: any;
// biome-ignore lint/suspicious/noExplicitAny: Mock types
let schema: any;
// biome-ignore lint/suspicious/noExplicitAny: Mock types
let db: any;

import type { MediaSource } from "~/infrastructure/db/schema";

describe("Media Type Handling Integration", () => {
  let mediaSource: MediaSource;
  const fixturesDir = "src/tests/fixtures";
  let tempSourceDir: string;
  const ExpectedMixedMediaCount = 3;

  beforeAll(async () => {
    try {
      const migratorModule = await import("drizzle-orm/pglite/migrator");
      migrate = migratorModule.migrate;
      schema = await import("~/infrastructure/db/schema");
      const dbModule = await import("~/infrastructure/db/index");
      db = dbModule.db;

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
    } catch (e) {
      console.error("Setup failed", e);
    }
  });

  beforeEach(async () => {
    tempSourceDir = await fs.mkdtemp(
      path.join(fixturesDir, "test-media-types-")
    );

    [mediaSource] = await db
      .insert(schema.mediaSources)
      .values({
        name: "Test Media Type Source",
        type: "local",
        connectionInfo: { path: tempSourceDir },
      })
      .returning();
  });

  afterEach(async () => {
    await db.delete(schema.mediaSources);
    await db.delete(schema.medias);
    if (tempSourceDir) {
      await fs.rm(tempSourceDir, { recursive: true, force: true });
    }
  });

  it("should register a video file as 'video' mediaType", async () => {
    const videoName = "test-video.mp4";
    const videoPath = path.join(tempSourceDir, videoName);
    await fs.writeFile(videoPath, "dummy video content");

    await MediaService.registerExistingMedia(mediaSource.id, tempSourceDir);

    const mediaList = await MediaService.getAllMedia(mediaSource.id);
    const videoMedia = mediaList.find((m) => m.fileName === videoName);

    expect(videoMedia).toBeDefined();
    expect(videoMedia?.mediaType).toBe("video");
  });

  it("should register an audio file as 'audio' mediaType", async () => {
    const audioName = "test-audio.mp3";
    const audioPath = path.join(tempSourceDir, audioName);
    await fs.writeFile(audioPath, "dummy audio content");

    await MediaService.registerExistingMedia(mediaSource.id, tempSourceDir);

    const mediaList = await MediaService.getAllMedia(mediaSource.id);
    const audioMedia = mediaList.find((m) => m.fileName === audioName);

    expect(audioMedia).toBeDefined();
    expect(audioMedia?.mediaType).toBe("audio");
  });

  it("should register mixed media types correctly", async () => {
    await fs.writeFile(path.join(tempSourceDir, "a.jpg"), "img");
    await fs.writeFile(path.join(tempSourceDir, "b.mp4"), "vid");
    await fs.writeFile(path.join(tempSourceDir, "c.wav"), "aud");

    await MediaService.registerExistingMedia(mediaSource.id, tempSourceDir);

    const mediaList = await MediaService.getAllMedia(mediaSource.id);
    expect(mediaList).toHaveLength(ExpectedMixedMediaCount);

    const img = mediaList.find((m) => m.fileName === "a.jpg");
    const vid = mediaList.find((m) => m.fileName === "b.mp4");
    const aud = mediaList.find((m) => m.fileName === "c.wav");

    expect(img?.mediaType).toBe("image");
    expect(vid?.mediaType).toBe("video");
    expect(aud?.mediaType).toBe("audio");
  });

  it("should return empty tags for non-image media types without error", async () => {
    const [videoMedia] = await db
      .insert(schema.medias)
      .values({
        mediaSourceId: mediaSource.id,
        filePath: "dummy.mp4",
        fileName: "dummy.mp4",
        mediaType: "video",
        width: 1920,
        height: 1080,
        fileSize: 1000,
      })
      .returning();

    const result = await taggingService.getTagsForMedia(
      mediaSource.id,
      videoMedia.id
    );

    expect(result).toBeDefined();
    expect(result.general).toEqual({});
    expect(result.character).toEqual({});
    expect(result.ips).toEqual([]);
  });

  it("should throw error for non-image media types in CCIP feature extraction", async () => {
    const [videoMedia] = await db
      .insert(schema.medias)
      .values({
        mediaSourceId: mediaSource.id,
        filePath: "dummy-ccip.mp4",
        fileName: "dummy-ccip.mp4",
        mediaType: "video",
        width: 1920,
        height: 1080,
        fileSize: 1000,
      })
      .returning();

    await expect(
      taggingService.getCcipFeatureForMedia(mediaSource.id, videoMedia.id)
    ).rejects.toThrow("CCIP feature extraction is only supported for images");
  });

  it("should return correct contentType from getMediaContent", async () => {
    // Create files
    await fs.writeFile(path.join(tempSourceDir, "video.mp4"), "data");
    await fs.writeFile(path.join(tempSourceDir, "audio.mp3"), "data");
    await fs.writeFile(path.join(tempSourceDir, "image.jpg"), "data");

    // Register them
    await MediaService.registerExistingMedia(mediaSource.id, tempSourceDir);
    const allMedia = await MediaService.getAllMedia(mediaSource.id);

    const vid = allMedia.find((m) => m.fileName === "video.mp4");
    const aud = allMedia.find((m) => m.fileName === "audio.mp3");
    const img = allMedia.find((m) => m.fileName === "image.jpg");

    if (!(vid && aud && img)) {
      throw new Error("Media setup failed");
    }

    const vidContent = await MediaService.getMediaContent(
      mediaSource.id,
      vid.id
    );
    expect(vidContent.contentType).toBe("video/mp4");

    const audContent = await MediaService.getMediaContent(
      mediaSource.id,
      aud.id
    );
    expect(audContent.contentType).toBe("audio/mpeg");

    const imgContent = await MediaService.getMediaContent(
      mediaSource.id,
      img.id
    );
    expect(imgContent.contentType).toBe("image/jpeg");
  });
});
