import { createWriteStream } from "node:fs";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { BackupService } from "~/application/services/backup-service";
import { db } from "~/infrastructure/db";
import {
  authors,
  characters,
  ips,
  mediaAuthors,
  mediaCharacters,
  mediaIps,
  mediaProjects,
  mediaSources,
  medias,
  mediaTags,
  projects,
  tags,
} from "~/infrastructure/db/schema";

describe("BackupService ZIP Integration", () => {
  const sourceId1 = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
  const sourceId2 = "e582784b-595a-4ed7-9aa1-d34345ada12c";
  const tempDir = path.join(os.tmpdir(), `backup-test-${Date.now()}`);
  const source1Path = path.join(tempDir, "source1");
  const source2Path = path.join(tempDir, "source2");

  beforeEach(async () => {
    // Clean DB
    await db.delete(mediaTags);
    await db.delete(mediaAuthors);
    await db.delete(mediaCharacters);
    await db.delete(mediaIps);
    await db.delete(mediaProjects);
    await db.delete(medias);
    await db.delete(tags);
    await db.delete(authors);
    await db.delete(characters);
    await db.delete(ips);
    await db.delete(projects);
    await db.delete(mediaSources);

    // Setup FS
    await fs.mkdir(source1Path, { recursive: true });
    await fs.mkdir(source2Path, { recursive: true });

    // Create Sources
    await db.insert(mediaSources).values({
      id: sourceId1,
      name: "Source 1",
      type: "local",
      connectionInfo: { path: source1Path },
    });

    await db.insert(mediaSources).values({
      id: sourceId2,
      name: "Source 2",
      type: "local",
      connectionInfo: { path: source2Path },
    });
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it("should create a ZIP backup and restore it successfully with all metadata", async () => {
    // 1. Setup Data in Source 1
    const testFileName = "test-image.png";
    const testFilePath = path.join(source1Path, testFileName);
    await fs.writeFile(testFilePath, "mock image content");

    const [media] = await db
      .insert(medias)
      .values({
        mediaSourceId: sourceId1,
        filePath: testFileName,
        fileName: testFileName,
        mediaType: "image",
        width: 100,
        height: 100,
        fileSize: 1024,
      })
      .returning();

    // Add Tags
    const [tag] = await db.insert(tags).values({ name: "Zip Tag" }).returning();
    await db.insert(mediaTags).values({
      mediaId: media.id,
      tagId: tag.id,
      tagType: "positive",
      confidence: 0.9,
    });

    // Add Author
    const [author] = await db
      .insert(authors)
      .values({ name: "Zip Author" })
      .returning();
    await db.insert(mediaAuthors).values({
      mediaId: media.id,
      authorId: author.id,
    });

    // Add Character
    const CHARACTER_CONFIDENCE = 0.8;
    const [character] = await db
      .insert(characters)
      .values({ name: "Zip Character" })
      .returning();
    await db.insert(mediaCharacters).values({
      mediaId: media.id,
      characterId: character.id,
      confidence: CHARACTER_CONFIDENCE,
    });

    // Add IP
    const IP_CONFIDENCE = 0.7;
    const [ip] = await db.insert(ips).values({ name: "Zip IP" }).returning();
    await db.insert(mediaIps).values({
      mediaId: media.id,
      ipId: ip.id,
      confidence: IP_CONFIDENCE,
    });

    // Add Project
    const [project] = await db
      .insert(projects)
      .values({ name: "Zip Project" })
      .returning();
    await db.insert(mediaProjects).values({
      mediaId: media.id,
      projectId: project.id,
    });

    // 2. Create ZIP Dump
    const zipStream: any = await BackupService.createDump(sourceId1, "zip");
    const zipFilePath = path.join(tempDir, "backup.zip");
    const writeStream = createWriteStream(zipFilePath);

    await pipeline(zipStream, writeStream);

    // 3. Restore to Source 2
    const importResult = await BackupService.importSourceZip(
      sourceId2,
      zipFilePath
    );

    expect(importResult.success).toBe(true);
    expect(importResult.importedCount).toBe(1);
    expect(importResult.skippedCount).toBe(0);

    // 4. Verify Data in Source 2
    const restoredMedia = await db.query.medias.findFirst({
      where: eq(medias.mediaSourceId, sourceId2),
      with: {
        tags: { with: { tag: true } },
        authors: { with: { author: true } },
        characters: { with: { character: true } },
        ips: { with: { ip: true } },
        projects: { with: { project: true } },
      },
    });

    expect(restoredMedia).toBeDefined();
    expect(restoredMedia?.filePath).toBe(testFileName);
    expect(restoredMedia?.tags[0].tag.name).toBe("Zip Tag");
    expect(restoredMedia?.authors[0].author.name).toBe("Zip Author");
    expect(restoredMedia?.characters[0].character.name).toBe("Zip Character");
    expect(restoredMedia?.characters[0].confidence).toBe(CHARACTER_CONFIDENCE);
    expect(restoredMedia?.ips[0].ip.name).toBe("Zip IP");
    expect(restoredMedia?.ips[0].confidence).toBe(IP_CONFIDENCE);
    expect(restoredMedia?.projects[0].project.name).toBe("Zip Project");

    // Verify file restored
    const restoredFilePath = path.join(source2Path, testFileName);
    const content = await fs.readFile(restoredFilePath, "utf-8");
    expect(content).toBe("mock image content");
  });
});
