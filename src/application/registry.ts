import { MediaProcessingServiceImpl } from "~/application/services/media-processing-service";
import type { IAiClient } from "~/domain/interfaces/ai-client";
import type { IAuthorRepository } from "~/domain/repositories/author-repository";
import type { CharacterRepository } from "~/domain/repositories/character-repository";
import type { IIpRepository } from "~/domain/repositories/ip-repository";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
import type { IProjectRepository } from "~/domain/repositories/project-repository";
import type { SourceRepository } from "~/domain/repositories/source-repository";
import type { TagRepository as TagRepositoryDef } from "~/domain/repositories/tag-repository";
import type { IImageProcessor } from "~/domain/services/image-processor";
import type { IStorageService } from "~/domain/services/storage-service";

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private mediaRepository?: IMediaRepository;
  private sourceRepository?: SourceRepository;
  private storageService?: IStorageService;
  private tagRepository?: TagRepositoryDef;
  private imageProcessor?: IImageProcessor;
  private aiClient?: IAiClient;
  private authorRepository?: IAuthorRepository;
  private projectRepository?: IProjectRepository;
  private characterRepository?: CharacterRepository;
  private ipRepository?: IIpRepository;
  private mediaProcessingService?: MediaProcessingServiceImpl;

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

  registerStorageService(service: IStorageService): void {
    this.storageService = service;
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

  getStorageService(): IStorageService {
    if (!this.storageService) {
      throw new Error("StorageService has not been registered.");
    }
    return this.storageService;
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

  getMediaProcessingService(): MediaProcessingServiceImpl {
    if (!this.mediaProcessingService) {
      this.mediaProcessingService = new MediaProcessingServiceImpl(
        this.getSourceRepository(),
        this.getMediaRepository(),
        this.getTagRepository(),
        this.getAuthorRepository(),
        this.getCharacterRepository(),
        this.getIpRepository(),
        this.getProjectRepository()
      );
    }
    return this.mediaProcessingService;
  }

  // Helper for testing to reset the registry
  async reset(): Promise<void> {
    this.mediaRepository = undefined;
    this.sourceRepository = undefined;
    this.storageService = undefined;
    this.tagRepository = undefined;
    this.imageProcessor = undefined;
    this.aiClient = undefined;
    this.authorRepository = undefined;
    this.projectRepository = undefined;
    this.characterRepository = undefined;
    this.ipRepository = undefined;
    this.mediaProcessingService = undefined;

    // Reset service singletons that might hold references to old repositories
    const { resetMediaService } = await import("./services/media-service");
    resetMediaService();
  }
}

export const services = ServiceRegistry.getInstance();
