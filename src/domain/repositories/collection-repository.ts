import type {
  Collection,
  NewCollection,
  NewCollectionItem,
  UpdateCollection,
} from "~/domain/collections/schemas";

// biome-ignore lint/style/useNamingConvention: Interface naming
export type ICollectionRepository = {
  findAll(): Promise<Collection[]>;
  findById(id: string): Promise<Collection | null>;
  create(collection: NewCollection): Promise<Collection>;
  update(id: string, collection: UpdateCollection): Promise<Collection>;
  delete(id: string): Promise<void>;
  addItem(collectionId: string, item: NewCollectionItem): Promise<void>;
  removeItem(collectionId: string, mediaId: string): Promise<void>;
};
