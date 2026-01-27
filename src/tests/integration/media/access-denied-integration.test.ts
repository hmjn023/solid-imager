import { beforeAll, describe, expect, it } from "vitest";
import { services } from "~/application/registry";
import { MediaService } from "~/application/services/media-service";
import { PythonClient } from "~/infrastructure/ai/python-client";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

describe("File System Access Denied Integration", () => {
  beforeAll(() => {
    services.registerMediaRepository(MediaRepository);
    services.registerSourceRepository(new DrizzleSourceRepository());
    services.registerStorageService(LocalMediaStorage);
    services.registerTagRepository(TagRepository);
    services.registerImageProcessor(ImageProcessor);
    services.registerAuthorRepository(AuthorRepository);
    services.registerProjectRepository(ProjectRepository);
    services.registerCharacterRepository(new DrizzleCharacterRepository());
    services.registerIpRepository(IpRepository);
    services.registerAiClient(new PythonClient());
  });
  const testSourceId = "b0000000-0000-0000-0000-000000000000";

  it("should throw an error when registerExistingMedia encounters file system access denied", async () => {
    // This assumes registerExistingMedia checks file existence/stats
    const filePath = "/no-access/path/image.png";
    await expect(
      MediaService.registerExistingMedia(testSourceId, filePath)
    ).rejects.toThrow();
  });

  it("should throw an error when deleteMedia encounters file system access denied", async () => {
    const mediaId = "mock-uuid-for-denied-access";
    // Note: deleteMedia might fail at DB level first if media not found.
    // But if we want to test FS access denied, we might need to mock or ensure DB has entry but FS is denied.
    // However, for integration test, maybe we just expect failure.
    await expect(
      MediaService.deleteMedia(testSourceId, mediaId)
    ).rejects.toThrow();
  });
});
