import { CharacterServiceImpl as AppCharacterServiceImpl } from "@solid-imager/application/services/character-service";
import type { NewCharacter, UpdateCharacter } from "@solid-imager/core/domain/characters/schemas";
import { services } from "~/application/registry";

export { CharacterServiceImpl } from "@solid-imager/application/services/character-service";

export const CharacterService = {
  getAllCharacters: async () =>
    services.getCharacterService().getAllCharacters(),
  createCharacter: async (data: NewCharacter) =>
    services.getCharacterService().createCharacter(data),
  findByName: async (name: string) =>
    services.getCharacterService().findByName(name),
  getCharacterDetails: async (id: string) =>
    services.getCharacterService().getCharacterDetails(id),
  updateCharacter: async (id: string, data: UpdateCharacter) =>
    services.getCharacterService().updateCharacter(id, data),
  deleteCharacter: async (id: string) =>
    services.getCharacterService().deleteCharacter(id),
  getCharactersForMedia: async (mediaId: string) =>
    services.getCharacterService().getCharactersForMedia(mediaId),
  addCharacterToMedia: async (mediaId: string, characterId: string) =>
    services.getCharacterService().addCharacterToMedia(mediaId, characterId),
  removeCharacterFromMedia: async (mediaId: string, characterId: string) =>
    services
      .getCharacterService()
      .removeCharacterFromMedia(mediaId, characterId),
};
