import type {
  IConfigService,
  IFileSystem,
  IMediaStorage,
} from "@solid-imager/core";
import type { IAiClient } from "@solid-imager/core/domain/interfaces/ai-client";
import type { IAuthorRepository } from "@solid-imager/core/domain/repositories/author-repository";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import type { IMediaRepository } from "@solid-imager/core/domain/repositories/media-repository";
import type { IProjectRepository } from "@solid-imager/core/domain/repositories/project-repository";
import type { SourceRepository } from "@solid-imager/core/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "@solid-imager/core/domain/repositories/tag-repository";
import type { IImageProcessor } from "@solid-imager/core/domain/services/image-processor";
import type { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";
import type { IJobRepository } from "~/domain/repositories/job-repository";
import type { JobWorker } from "~/infrastructure/jobs/job-worker";

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private mediaRepository?: IMediaRepository;
  private sourceRepository?: SourceRepository;
  private mediaStorage?: IMediaStorage;
  private fileSystem?: IFileSystem;
  private tagRepository?: TagRepositoryDef;
  private imageProcessor?: IImageProcessor;
  private aiClient?: IAiClient;
  private authorRepository?: IAuthorRepository;
  private projectRepository?: IProjectRepository;
  private characterRepository?: CharacterRepository;
  private ipRepository?: IIpRepository;
  private jobRepository?: IJobRepository;
  private jobWorker?: JobWorker;
  private mediaProcessingService?: MediaProcessingServiceImpl;
  private configService?: IConfigService;

  private constructor() {}

  static getInstance(): ServiceRegistry {
    if (!ServiceRegistry.instance) {
      ServiceRegistry.instance = new ServiceRegistry();
    }
    return ServiceRegistry.instance;
  }

  registerMediaRepository(repo: IMediaRepository): void {
    this.mediaRepository = repo;
  }

  registerSourceRepository(repo: SourceRepository): void {
    this.sourceRepository = repo;
  }

  registerMediaStorage(service: IMediaStorage): void {
    this.mediaStorage = service;
  }

  registerFileSystem(fs: IFileSystem): void {
    this.fileSystem = fs;
  }

  registerTagRepository(repo: TagRepositoryDef): void {
    this.tagRepository = repo;
  }

  registerImageProcessor(processor: IImageProcessor): void {
    this.imageProcessor = processor;
  }

  registerAiClient(client: IAiClient): void {
    this.aiClient = client;
  }

  registerAuthorRepository(repo: IAuthorRepository): void {
    this.authorRepository = repo;
  }

  registerProjectRepository(repo: IProjectRepository): void {
    this.projectRepository = repo;
  }

  registerCharacterRepository(repo: CharacterRepository): void {
    this.characterRepository = repo;
  }

  registerIpRepository(repo: IIpRepository): void {
    this.ipRepository = repo;
  }

  registerJobRepository(repo: IJobRepository): void {
    this.jobRepository = repo;
  }

  registerJobWorker(worker: JobWorker): void {
    this.jobWorker = worker;
  }

  getMediaRepository(): IMediaRepository {
    if (!this.mediaRepository) {
      throw new Error("MediaRepository has not been registered.");
    }
    return this.mediaRepository;
  }

  getSourceRepository(): SourceRepository {
    if (!this.sourceRepository) {
      throw new Error("SourceRepository has not been registered.");
    }
    return this.sourceRepository;
  }

  getMediaStorage(): IMediaStorage {
    if (!this.mediaStorage) {
      throw new Error("MediaStorage has not been registered.");
    }
    return this.mediaStorage;
  }

  getFileSystem(): IFileSystem {
    if (!this.fileSystem) {
      throw new Error("FileSystem has not been registered.");
    }
    return this.fileSystem;
  }

  getImageProcessor(): IImageProcessor {
    if (!this.imageProcessor) {
      throw new Error("ImageProcessor has not been registered.");
    }
    return this.imageProcessor;
  }

  getTagRepository(): TagRepositoryDef {
    if (!this.tagRepository) {
      throw new Error("TagRepository has not been registered.");
    }
    return this.tagRepository;
  }

  getAiClient(): IAiClient {
    if (!this.aiClient) {
      throw new Error("AiClient has not been registered.");
    }
    return this.aiClient;
  }

  getAuthorRepository(): IAuthorRepository {
    if (!this.authorRepository) {
      throw new Error("AuthorRepository has not been registered.");
    }
    return this.authorRepository;
  }

  getProjectRepository(): IProjectRepository {
    if (!this.projectRepository) {
      throw new Error("ProjectRepository has not been registered.");
    }
    return this.projectRepository;
  }

  getCharacterRepository(): CharacterRepository {
    if (!this.characterRepository) {
      throw new Error("CharacterRepository has not been registered.");
    }
    return this.characterRepository;
  }

  getIpRepository(): IIpRepository {
    if (!this.ipRepository) {
      throw new Error("IpRepository has not been registered.");
    }
    return this.ipRepository;
  }

  getJobRepository(): IJobRepository {
    if (!this.jobRepository) {
      throw new Error("JobRepository has not been registered.");
    }
    return this.jobRepository;
  }

  getJobWorker(): JobWorker {
    if (!this.jobWorker) {
      throw new Error("JobWorker has not been registered.");
    }
    return this.jobWorker;
  }

  registerMediaProcessingService(service: MediaProcessingServiceImpl): void {
    this.mediaProcessingService = service;
  }

  getMediaProcessingService(): MediaProcessingServiceImpl {
    if (!this.mediaProcessingService) {
      throw new Error("MediaProcessingService has not been registered.");
    }
    return this.mediaProcessingService;
  }

  registerConfigService(service: IConfigService): void {
    this.configService = service;
  }

  getConfigService(): IConfigService {
    if (!this.configService) {
      throw new Error("ConfigService has not been registered.");
    }
    return this.configService;
  }

  // Helper for testing to reset the registry
  async reset(): Promise<void> {
    this.mediaRepository = undefined;
    this.sourceRepository = undefined;
    this.mediaStorage = undefined;
    this.fileSystem = undefined;
    this.tagRepository = undefined;
    this.imageProcessor = undefined;
    this.aiClient = undefined;
    this.authorRepository = undefined;
    this.projectRepository = undefined;
    this.characterRepository = undefined;
    this.ipRepository = undefined;
    this.jobRepository = undefined;
    this.jobWorker = undefined;
    this.mediaProcessingService = undefined;
    this.configService = undefined;

    // Reset service singletons that might hold references to old repositories
    const { resetMediaService } = await import("./services/media-service");
    resetMediaService();
  }
}

export const services = ServiceRegistry.getInstance();
