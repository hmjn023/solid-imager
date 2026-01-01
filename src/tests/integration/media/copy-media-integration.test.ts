import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { services } from "~/application/registry";
import { MediaService } from "~/application/services/media-service";
import { db } from "~/infrastructure/db/index";
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
} from "~/infrastructure/db/schema";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";

// Mocks
const mockStorageService = {
  copyFile: vi.fn().mockResolvedValue({
    filePath: "/new/path/file.png",
    fileName: "file.png",
    width: 800,
    height: 600,
    size: 1024,
  }),
  deleteFile: vi.fn().mockResolvedValue(undefined),
  moveFile: vi.fn(),
  listFiles: vi.fn(),
  getFileStats: vi.fn(),
  createDirectory: vi.fn(),
  deleteDirectory: vi.fn(),
  watch: vi.fn(),
};

const mockImageProcessor = {
  extractMetadata: vi.fn(),
  generateThumbnail: vi.fn(),
  getMetadata: vi.fn(),
};

const mockAiClient = {
  generateImage: vi.fn(),
  analyzeImage: vi.fn(),
};

describe("MediaService - Copy Media Integration", () => {
  const sourceSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12949";
  const targetSourceId = "dce7b2a1-93ba-4c49-b1eb-f25dafb12950";

  beforeEach(async () => {
    // Reset registry and register services
    services.reset();
    services.registerMediaRepository(MediaRepository);
    services.registerSourceRepository(new DrizzleSourceRepository());
    services.registerTagRepository(TagRepository);
    services.registerStorageService(mockStorageService as any);
    services.registerImageProcessor(mockImageProcessor as any);
    services.registerAiClient(mockAiClient as any);

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
    await db.delete(mediaSources);

    // Create Sources
    await db.insert(mediaSources).values([
      {
        id: sourceSourceId,
        name: "Source Source",
        type: "local",
        connectionInfo: { path: "/source" },
      },
      {
        id: targetSourceId,
        name: "Target Source",
        type: "local",
        connectionInfo: { path: "/target" },
      },
    ]);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should copy media along with projects, characters, and ips", async () => {
    // 1. Prepare Source Data
    // Create Media
    const [sourceMedia] = await db
      .insert(medias)
      .values({
        mediaSourceId: sourceSourceId,
        filePath: "/source/file.png",
        fileName: "file.png",
        mediaType: "image",
        width: 800,
        height: 600,
        fileSize: 1024,
      })
      .returning();

    // Create Metadata Entities
    const [project] = await db
      .insert(projects)
      .values({ name: "Test Project" })
      .returning();
    const [ip] = await db.insert(ips).values({ name: "Test IP" }).returning();
    const [character] = await db
      .insert(characters)
      .values({ name: "Test Character", ipId: ip.id })
      .returning();

    // Link Metadata to Source Media
    await db
      .insert(mediaProjects)
      .values({ mediaId: sourceMedia.id, projectId: project.id });
    await db.insert(mediaIps).values({ mediaId: sourceMedia.id, ipId: ip.id });
    await db
      .insert(mediaCharacters)
      .values({ mediaId: sourceMedia.id, characterId: character.id });

    // 2. Execute Copy
    const result = await MediaService.copyMedia(sourceMedia.id, targetSourceId);

    // 3. Verify Result
    expect(result.success).toBe(true);
    const newMediaId = result.media.id;
    expect(newMediaId).not.toBe(sourceMedia.id);

    // Check Projects
    const linkedProjects = await db
      .select()
      .from(mediaProjects)
      .where(eq(mediaProjects.mediaId, newMediaId));
    expect(linkedProjects).toHaveLength(1);
    expect(linkedProjects[0].projectId).toBe(project.id);

    // Check IPs
    const linkedIps = await db
      .select()
      .from(mediaIps)
      .where(eq(mediaIps.mediaId, newMediaId));
    expect(linkedIps).toHaveLength(1);
    expect(linkedIps[0].ipId).toBe(ip.id);

    // Check Characters
    const linkedCharacters = await db
      .select()
      .from(mediaCharacters)
      .where(eq(mediaCharacters.mediaId, newMediaId));
    expect(linkedCharacters).toHaveLength(1);
    expect(linkedCharacters[0].characterId).toBe(character.id);
  });

  it("should move media along with projects, characters, and ips", async () => {
    // 1. Prepare Source Data
    // Create Media
    const [sourceMedia] = await db
      .insert(medias)
      .values({
        mediaSourceId: sourceSourceId,
        filePath: "/source/file-move.png",
        fileName: "file-move.png",
        mediaType: "image",
        width: 800,
        height: 600,
        fileSize: 1024,
      })
      .returning();

    // Create Metadata Entities
    const [project] = await db
      .insert(projects)
      .values({ name: "Move Project" })
      .returning();
    const [ip] = await db.insert(ips).values({ name: "Move IP" }).returning();
    const [character] = await db
      .insert(characters)
      .values({ name: "Move Character", ipId: ip.id })
      .returning();

    // Link Metadata to Source Media
    await db
      .insert(mediaProjects)
      .values({ mediaId: sourceMedia.id, projectId: project.id });
    await db.insert(mediaIps).values({ mediaId: sourceMedia.id, ipId: ip.id });
    await db
      .insert(mediaCharacters)
      .values({ mediaId: sourceMedia.id, characterId: character.id });

    // 2. Execute Move
    const result = await MediaService.moveMedia(sourceMedia.id, targetSourceId);

    // 3. Verify Result
    expect(result.success).toBe(true);
    const newMediaId = result.media.id;
    expect(newMediaId).not.toBe(sourceMedia.id);

    // Check Projects
    const linkedProjects = await db
      .select()
      .from(mediaProjects)
      .where(eq(mediaProjects.mediaId, newMediaId));
    expect(linkedProjects).toHaveLength(1);
    expect(linkedProjects[0].projectId).toBe(project.id);

    // Check IPs
    const linkedIps = await db
      .select()
      .from(mediaIps)
      .where(eq(mediaIps.mediaId, newMediaId));
    expect(linkedIps).toHaveLength(1);
    expect(linkedIps[0].ipId).toBe(ip.id);

    // Check Characters
    const linkedCharacters = await db
      .select()
      .from(mediaCharacters)
      .where(eq(mediaCharacters.mediaId, newMediaId));
    expect(linkedCharacters).toHaveLength(1);
    expect(linkedCharacters[0].characterId).toBe(character.id);

    // 4. Verify Source Media Deletion
    const oldMedia = await MediaRepository.findById(sourceMedia.id);
    expect(oldMedia).toBeNull();
  });
});
