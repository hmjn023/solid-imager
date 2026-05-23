import { createCollectionService } from "@solid-imager/application/services/collection-service";
import { CollectionRepository } from "~/infrastructure/repositories/collection-repository";

export const CollectionService = createCollectionService(CollectionRepository);
