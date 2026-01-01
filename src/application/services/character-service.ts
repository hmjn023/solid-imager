import type {
  NewCharacter,
  UpdateCharacter,
} from "~/domain/characters/schemas";
import type {
  Character,
  CharacterRepository,
} from "~/domain/repositories/character-repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";

// Initialize repository
const characterRepo: CharacterRepository = new DrizzleCharacterRepository();

const getAllCharactersServer = async (): Promise<Character[]> =>
  await characterRepo.findAll();

const createCharacterServer = async (data: NewCharacter): Promise<Character> =>
  await characterRepo.create(data);

const getCharacterByIdServer = async (
  id: string
): Promise<Character | undefined> => {
  const result = await characterRepo.findById(id);
  return result ?? undefined;
};

const updateCharacterServer = async (
  id: string,
  data: UpdateCharacter
): Promise<Character> => await characterRepo.update(id, data);

const deleteCharacterServer = async (
  id: string
): Promise<{ success: true }> => {
  await characterRepo.delete(id);
  return { success: true };
};

const getCharactersForMediaServer = async (
  mediaId: string
): Promise<Character[]> => await characterRepo.findByMediaId(mediaId);

const addCharacterToMediaServer = async (
  mediaId: string,
  characterId: string
): Promise<void> => {
  await characterRepo.addToMedia(mediaId, characterId);
};

const removeCharacterFromMediaServer = async (
  mediaId: string,
  characterId: string
): Promise<void> => {
  await characterRepo.removeFromMedia(mediaId, characterId);
};

export const CharacterService = {
  getAllCharacters: getAllCharactersServer,
  createCharacter: createCharacterServer,
  getCharacterDetails: getCharacterByIdServer,
  updateCharacter: updateCharacterServer,
  deleteCharacter: deleteCharacterServer,
  getCharactersForMedia: getCharactersForMediaServer,
  addCharacterToMedia: addCharacterToMediaServer,
  removeCharacterFromMedia: removeCharacterFromMediaServer,
};
