import type { Character, NewCharacter, UpdateCharacter } from "@solid-imager/core/domain/characters/schemas";

export interface ICharacterService {
  getAllCharacters(): Promise<Character[]>;
  createCharacter(data: NewCharacter): Promise<Character>;
  findByName(name: string): Promise<Character | null>;
  getCharacterDetails(id: string): Promise<Character | undefined>;
  updateCharacter(id: string, data: UpdateCharacter): Promise<Character>;
  deleteCharacter(id: string): Promise<{ success: true }>;
  getCharactersForMedia(mediaId: string): Promise<Character[]>;
  addCharacterToMedia(mediaId: string, characterId: string): Promise<void>;
  removeCharacterFromMedia(mediaId: string, characterId: string): Promise<void>;
}
