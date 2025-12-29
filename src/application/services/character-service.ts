import { cache } from "@solidjs/router";
import type {
  NewCharacter,
  UpdateCharacter,
} from "~/domain/characters/schemas";
import type {
  Character,
  CharacterRepository,
} from "~/domain/repositories/character.repository";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";

// Initialize repository
const characterRepo: CharacterRepository = new DrizzleCharacterRepository();

const getAllCharactersServer = cache(async (): Promise<Character[]> => {
  "use server";
  return await characterRepo.findAll();
}, "getAllCharacters");

const createCharacterServer = async (
  data: NewCharacter
): Promise<Character> => {
  "use server";
  return await characterRepo.create(data);
};

const getCharacterByIdServer = cache(
  async (id: string): Promise<Character | undefined> => {
    "use server";
    const result = await characterRepo.findById(id);
    return result ?? undefined;
  },
  "getCharacterById"
);

const updateCharacterServer = async (
  id: string,
  data: UpdateCharacter
): Promise<Character> => {
  "use server";
  return await characterRepo.update(id, data);
};

const deleteCharacterServer = async (
  id: string
): Promise<{ success: true }> => {
  "use server";
  await characterRepo.delete(id);
  return { success: true };
};

const getCharactersForMediaServer = cache(
  async (mediaId: string): Promise<Character[]> => {
    "use server";
    return await characterRepo.findByMediaId(mediaId);
  },
  "getCharactersForMedia"
);

const addCharacterToMediaServer = async (
  mediaId: string,
  characterId: string
): Promise<void> => {
  "use server";
  await characterRepo.addToMedia(mediaId, characterId);
};

const removeCharacterFromMediaServer = async (
  mediaId: string,
  characterId: string
): Promise<void> => {
  "use server";
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
