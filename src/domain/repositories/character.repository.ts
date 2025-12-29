import type {
  Character,
  NewCharacter,
  UpdateCharacter,
} from "~/domain/characters/schemas";

export type {
  Character,
  NewCharacter,
  UpdateCharacter,
} from "~/domain/characters/schemas";

export type CharacterRepository = {
  findAll(): Promise<Character[]>;
  findById(id: string): Promise<Character | null>;
  create(character: NewCharacter): Promise<Character>;
  update(id: string, character: UpdateCharacter): Promise<Character>;
  delete(id: string): Promise<void>;
  findByMediaId(mediaId: string): Promise<Character[]>;
  addToMedia(mediaId: string, characterId: string): Promise<void>;
  removeFromMedia(mediaId: string, characterId: string): Promise<void>;
};
