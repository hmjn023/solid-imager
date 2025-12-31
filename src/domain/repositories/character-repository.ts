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
  create(character: NewCharacter, tx?: Transaction): Promise<Character>;
  update(
    id: string,
    character: UpdateCharacter,
    tx?: Transaction
  ): Promise<Character>;
  delete(id: string, tx?: Transaction): Promise<void>;
  findByMediaId(mediaId: string, tx?: Transaction): Promise<Character[]>;
  addToMedia(
    mediaId: string,
    characterId: string,
    tx?: Transaction
  ): Promise<void>;
  removeFromMedia(
    mediaId: string,
    characterId: string,
    tx?: Transaction
  ): Promise<void>;
};
