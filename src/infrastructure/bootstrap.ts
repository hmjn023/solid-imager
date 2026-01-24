import { services } from "~/application/registry";
import { processJob } from "~/application/services/job-dispatch-service";
import { pythonClient } from "~/infrastructure/ai/python-client";
import { JobWorker } from "~/infrastructure/jobs/job-worker";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { JobRepository } from "~/infrastructure/repositories/job-repository";
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

  const jobRepo = new JobRepository();
  services.registerJobRepository(jobRepo);

  // Register Services
  services.registerStorageService(LocalMediaStorage);
  services.registerImageProcessor(ImageProcessor);
  services.registerAiClient(pythonClient);

  const jobWorker = new JobWorker(jobRepo, processJob);
  services.registerJobWorker(jobWorker);
  jobWorker.start(); // Auto-start the worker for now
}
