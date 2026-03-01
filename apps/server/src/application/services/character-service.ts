import type {
  Character,
  NewCharacter,
  UpdateCharacter,
} from "@solid-imager/core/domain/characters/schemas";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import { services } from "~/application/registry";

export class CharacterServiceImpl {
  private readonly characterRepo: CharacterRepository;

  constructor(characterRepo: CharacterRepository) {
    this.characterRepo = characterRepo;
  }

  async getAllCharacters(): Promise<Character[]> {
    return await this.characterRepo.findAll();
  }

  async createCharacter(data: NewCharacter): Promise<Character> {
    return await this.characterRepo.create(data);
  }

  async getCharacterDetails(id: string): Promise<Character | undefined> {
    const result = await this.characterRepo.findById(id);
    return result ?? undefined;
  }

  async updateCharacter(id: string, data: UpdateCharacter): Promise<Character> {
    return await this.characterRepo.update(id, data);
  }

  async deleteCharacter(id: string): Promise<{ success: true }> {
    await this.characterRepo.delete(id);
    return { success: true };
  }

  async getCharactersForMedia(mediaId: string): Promise<Character[]> {
    return await this.characterRepo.findByMediaId(mediaId);
  }

  async addCharacterToMedia(
    mediaId: string,
    characterId: string
  ): Promise<void> {
    const character = await this.characterRepo.findById(characterId);
    if (!character) {
      throw new Error(`Character not found: ${characterId}`);
    }

    await this.characterRepo.addToMedia(mediaId, characterId);

    // Auto-assign linked IPs
    if (character.ips && character.ips.length > 0) {
      const { IpRepository: ipRepo } = await import(
        "~/infrastructure/repositories/ip-repository"
      );
      for (const ip of character.ips) {
        await ipRepo.addMedia(mediaId, ip.id, undefined, "character_link");
      }
    }
  }

  async removeCharacterFromMedia(
    mediaId: string,
    characterId: string
  ): Promise<void> {
    await this.characterRepo.removeFromMedia(mediaId, characterId);
  }
}

// Backward compatibility proxy
export const CharacterService = {
  getAllCharacters: async () =>
    services.getCharacterService().getAllCharacters(),
  createCharacter: async (data: NewCharacter) =>
    services.getCharacterService().createCharacter(data),
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
