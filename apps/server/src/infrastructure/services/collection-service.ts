import { createCollectionService } from "@solid-imager/application/collections";
import { CollectionRepository } from "~/infrastructure/db/repositories";

export const CollectionService = createCollectionService(CollectionRepository);
