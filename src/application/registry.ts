import type { IAiClient } from "~/domain/interfaces/ai-client";
import type { IMediaRepository } from "~/domain/repositories/media-repository";
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

  // Helper for testing to reset the registry
  async reset(): Promise<void> {
    this.mediaRepository = undefined;
    this.sourceRepository = undefined;
    this.storageService = undefined;
    this.tagRepository = undefined;
    this.imageProcessor = undefined;
    this.aiClient = undefined;

    // Reset service singletons that might hold references to old repositories
    const { resetMediaService } = await import("./services/media-service");
    resetMediaService();
  }
}

export const services = ServiceRegistry.getInstance();
