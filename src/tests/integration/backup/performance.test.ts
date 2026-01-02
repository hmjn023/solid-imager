import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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
  projects,
  tags,
} from "~/infrastructure/db/schema";

// Mock external modules
vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual("node:fs/promises");
  return {
    ...actual,
    access: vi.fn().mockResolvedValue(undefined),
  };
});

describe("BackupService Performance", () => {
  const testSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";

  beforeEach(async () => {
    // Clean DB
    await db.delete(mediaProjects);
    await db.delete(mediaCharacters);
    await db.delete(mediaIps);
    await db.delete(mediaAuthors);
    await db.delete(medias);
    await db.delete(projects);
    await db.delete(characters);
    await db.delete(ips);
    await db.delete(authors);
    await db.delete(tags);
    await db.delete(mediaSources);

    // Create Source
    await db.insert(mediaSources).values({
      id: testSourceId,
      name: "Perf Test Source",
      type: "s3", // Bypass fs.access check
      connectionInfo: { path: "/perf-test" },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should restore 1000 items efficiently", async () => {
    const itemCount = 1000;
    const items = Array.from({ length: itemCount }, (_, i) => ({
      filePath: `image-${i}.png`,
      fileName: `image-${i}.png`,
      mediaType: "image",
      width: 800,
      height: 600,
      fileSize: 1024,
      createdAt: new Date().toISOString(),
      modifiedAt: new Date().toISOString(),
      tags: [
        // biome-ignore lint/style/noMagicNumbers: test data generation
        { name: `Tag A ${i % 10}`, type: "positive" },
        // biome-ignore lint/style/noMagicNumbers: test data generation
        { name: `Tag B ${i % 20}`, type: "positive" },
      ],
      // biome-ignore lint/style/noMagicNumbers: test data generation
      authors: [{ name: `Author ${i % 5}` }],
      // biome-ignore lint/style/noMagicNumbers: test data generation
      projects: [{ name: `Project ${i % 3}` }],
    }));

    const startTime = performance.now();
    const result = await BackupService.restoreSource(testSourceId, items);
    const endTime = performance.now();

    const duration = endTime - startTime;
    console.log(`Restored ${itemCount} items in ${duration.toFixed(2)}ms`);

    expect(result.processed).toBe(itemCount);
    expect(result.errors).toHaveLength(0);

    // Verify DB count
    const mediaCount = await db.query.medias.findMany({
      where: eq(medias.mediaSourceId, testSourceId),
    });
    expect(mediaCount).toHaveLength(itemCount);

    // Performance assertion (Soft limit: 1000 items should take less than 5 seconds on average hardware with in-memory DB)
    // Adjust based on environment
    // biome-ignore lint/style/noMagicNumbers: performance threshold
    expect(duration).toBeLessThan(5000);
  });
});
