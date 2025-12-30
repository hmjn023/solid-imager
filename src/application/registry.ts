import type { IMediaRepository } from "~/domain/repositories/media-repository";

export class ServiceRegistry {
  private static instance: ServiceRegistry;
  private mediaRepository?: IMediaRepository;

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

  getMediaRepository(): IMediaRepository {
    if (!this.mediaRepository) {
      throw new Error("MediaRepository has not been registered.");
    }
    return this.mediaRepository;
  }

  // Helper for testing to reset the registry
  reset(): void {
    this.mediaRepository = undefined;
  }
}

export const services = ServiceRegistry.getInstance();
