import type {
  Character,
  NewCharacter,
  UpdateCharacter,
} from "@solid-imager/core/domain/characters/schemas";
import type {
  Transaction,
  TransactionManager,
} from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import { services } from "~/application/registry";

export class CharacterServiceImpl {
  readonly characterRepo: CharacterRepository;
  private readonly ipRepo: IIpRepository;
  private readonly transactionManager: TransactionManager;

  constructor(
    characterRepo: CharacterRepository,
    ipRepo: IIpRepository,
    transactionManager: TransactionManager
  ) {
    this.characterRepo = characterRepo;
    this.ipRepo = ipRepo;
    this.transactionManager = transactionManager;
  }

  async getAllCharacters(): Promise<Character[]> {
    return await this.characterRepo.findAll();
  }

  async createCharacter(data: NewCharacter): Promise<Character> {
    return await this.characterRepo.create(data);
  }

  async findByName(name: string): Promise<Character | null> {
    return await this.characterRepo.findByName(name);
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
    await this.transactionManager.transaction(async (tx: Transaction) => {
      // NOTE: findById in DrizzleCharacterRepository already includes IPs relative to the character
      const character = await this.characterRepo.findById(characterId, tx);
      if (!character) {
        throw new Error(`Character not found: ${characterId}`);
      }

      await this.characterRepo.addToMedia(
        mediaId,
        character.id,
        undefined as number | undefined,
        undefined as string | undefined, // Fixed type mismatch
        tx
      );

      // Auto-assign linked IPs
      await this.linkCharacterIps(mediaId, character, tx);
    });
  }

  /**
   * Links all IPs associated with a character to a media item.
   */
  async linkCharacterIps(
    mediaId: string,
    character: Character,
    tx?: Transaction
  ): Promise<void> {
    if (character.ips && character.ips.length > 0) {
      for (const ip of character.ips) {
        await this.ipRepo.addMedia(
          mediaId,
          ip.id,
          undefined,
          "character_link",
          tx
        );
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
