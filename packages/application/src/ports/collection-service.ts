import type {
  Collection,
  NewCollection,
  UpdateCollection,
  NewCollectionItem,
} from "@solid-imager/core/domain/collections/schemas";

export interface ICollectionService {
  getAll(): Promise<Collection[]>;
  getById(id: string): Promise<Collection | undefined>;
  create(data: NewCollection): Promise<Collection>;
  update(id: string, data: UpdateCollection): Promise<Collection>;
  delete(id: string): Promise<void>;
  addItem(id: string, item: NewCollectionItem): Promise<void>;
  removeItem(id: string, mediaId: string): Promise<void>;
}
