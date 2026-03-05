import { services } from "~/application/registry";
import { CharacterServiceImpl } from "~/application/services/character-service";
import { processJob } from "~/application/services/job-dispatch-service";
import { MaintenanceService } from "~/application/services/maintenance-service";
import { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";
import { ServerConfigService } from "~/application/services/server-config-service";
import { PythonClient } from "~/infrastructure/ai/python-client";
import { DrizzleTransactionManager } from "~/infrastructure/db/transaction-manager";
import { NodeFileSystem } from "~/infrastructure/file-system/node-file-system";
import { JobWorker } from "~/infrastructure/jobs/job-worker";
import { logger, updateLogLevel } from "~/infrastructure/logger";
import { ImageProcessor } from "~/infrastructure/processing/image-processor";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";
import { IpRepository } from "~/infrastructure/repositories/ip-repository";
import { JobRepository } from "~/infrastructure/repositories/job-repository";
import { MediaRepository } from "~/infrastructure/repositories/media-repository";
import { ProjectRepository } from "~/infrastructure/repositories/project-repository";
import { DrizzleSourceRepository } from "~/infrastructure/repositories/source-repository";
import { TagRepository } from "~/infrastructure/repositories/tag-repository";
import { ServerMediaStorage } from "~/infrastructure/storage/server-media-storage";

export let isBootstrapped = false;

export function bootstrap() {
  if (isBootstrapped) {
    return;
  }
  isBootstrapped = true;

  // Initialize and load configuration
  const configService = new ServerConfigService();
  configService.load();
  services.registerConfigService(configService);

  const config = configService.getConfig();

  // Initialize log level from config and subscribe to changes
  updateLogLevel(config.logging.level);
  configService.onChange((newConfig) =>
    updateLogLevel(newConfig.logging.level)
  );

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
  services.registerMediaStorage(ServerMediaStorage);
  services.registerFileSystem(new NodeFileSystem());
  services.registerImageProcessor(ImageProcessor);

  // Initialize PythonClient with config values
  const pythonClient = new PythonClient(config.ai.baseUrl, config.ai.timeoutMs);
  services.registerAiClient(pythonClient);
  configService.onChange((newConfig) =>
    pythonClient.updateConfig(newConfig.ai)
  );

  const jobWorker = new JobWorker(jobRepo, processJob);
  // Initialize worker with current config and subscribe to changes
  jobWorker.updateConfig(configService.getConfig());
  configService.onChange((newConfig) => jobWorker.updateConfig(newConfig));

  services.registerJobWorker(jobWorker);

  services.registerCharacterService(
    new CharacterServiceImpl(
      services.getCharacterRepository(),
      services.getIpRepository(),
      DrizzleTransactionManager
    )
  );

  // Register MediaProcessingService (Implementation)
  services.registerMediaProcessingService(
    new MediaProcessingServiceImpl(
      services.getSourceRepository(),
      services.getMediaRepository(),
      services.getTagRepository(),
      services.getAuthorRepository(),
      services.getCharacterService(),
      services.getIpRepository(),
      services.getProjectRepository(),
      jobRepo,
      configService
    )
  );

  // Singleton management for JobWorker to prevent duplicates during HMR
  // biome-ignore lint/suspicious/noExplicitAny: Global augmentation
  const globalAny = globalThis as any;
  if (globalAny.__JOB_WORKER__) {
    // console.log("[Bootstrap] Stopping existing JobWorker...");
    globalAny.__JOB_WORKER__.stop();
  }

  globalAny.__JOB_WORKER__ = jobWorker;
  jobWorker.start();

  // Initialize MaintenanceService and perform startup checks (background)
  const maintenanceService = new MaintenanceService(
    services.getMediaRepository(),
    jobRepo,
    services.getSourceRepository()
  );

  maintenanceService.performStartupChecks().catch((err) => {
    logger.error({ err }, "Maintenance startup checks failed");
  });

  // Cleanup on process exit
  if (!globalAny.__BOOTSTRAP_CLEANUP_REGISTERED__) {
    const cleanup = () => {
      // console.log("[Bootstrap] Cleaning up JobWorker...");
      if (globalAny.__JOB_WORKER__) {
        globalAny.__JOB_WORKER__.stop();
      }
    };

    process.on("SIGINT", () => {
      cleanup();
      process.exit(0);
    });

    process.on("SIGTERM", () => {
      cleanup();
      process.exit(0);
    });

    globalAny.__BOOTSTRAP_CLEANUP_REGISTERED__ = true;
  }
}
