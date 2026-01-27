import type {
  Character,
  NewCharacter,
  UpdateCharacter,
} from "~/domain/characters/schemas";
import type { Transaction } from "~/domain/interfaces/transaction-manager";

export type {
  Character,
  NewCharacter,
  UpdateCharacter,
} from "~/domain/characters/schemas";

export type CharacterRepository = {
  findAll(): Promise<Character[]>;
  findById(id: string, tx?: Transaction): Promise<Character | null>;
  findByName(name: string, tx?: Transaction): Promise<Character | null>;
  create(character: NewCharacter, tx?: Transaction): Promise<Character>;
  update(
    id: string,
    character: UpdateCharacter,
    tx?: Transaction
  ): Promise<Character>;
  delete(id: string, tx?: Transaction): Promise<void>;
  findByMediaId(mediaId: string, tx?: Transaction): Promise<Character[]>;
  getMediaCharacters(
    mediaId: string,
    tx?: Transaction
  ): Promise<
    (Character & { confidence: number | null; associationSource: string })[]
  >;
  addToMedia(
    mediaId: string,
    characterId: string,
    confidence?: number,
    source?: string,
    tx?: Transaction
  ): Promise<void>;
  removeFromMedia(
    mediaId: string,
    characterId: string,
    tx?: Transaction
  ): Promise<void>;
  addToMediaBulk(
    mediaId: string,
    characters: { id: string; confidence?: number }[],
    source?: string,
    tx?: Transaction
  ): Promise<void>;
};
