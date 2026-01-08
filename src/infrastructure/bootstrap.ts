import { services } from "~/application/registry";
import { pythonClient } from "~/infrastructure/ai/python-client";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { LocalMediaStorage } from "~/infrastructure/storage/local-media-storage";

export function bootstrap() {
  // Register Repositories
  services.registerMediaRepository(MediaRepository);
  services.registerSourceRepository(new DrizzleSourceRepository());
  services.registerTagRepository(TagRepository);
  services.registerAuthorRepository(AuthorRepository);
  services.registerProjectRepository(ProjectRepository);
  services.registerCharacterRepository(new DrizzleCharacterRepository());
  services.registerIpRepository(IpRepository);

  // Register Services
  services.registerStorageService(LocalMediaStorage);
  services.registerImageProcessor(ImageProcessor);
  services.registerAiClient(pythonClient);
}
