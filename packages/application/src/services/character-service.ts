import type { Character, NewCharacter, UpdateCharacter } from "@solid-imager/core/domain/characters/schemas";
import type { Transaction, TransactionManager } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";

export class CharacterServiceImpl {
  readonly characterRepo: CharacterRepository;
  private readonly ipRepo: IIpRepository;
  private readonly transactionManager: TransactionManager;

  constructor(
    characterRepo: CharacterRepository,
    ipRepo: IIpRepository,
    transactionManager: TransactionManager,
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
    characterId: string,
  ): Promise<void> {
    return await this.transactionManager.transaction(
      async (tx: Transaction) => {
        const character = await this.characterRepo.findById(characterId, tx);
        if (!character) {
          throw new Error(`Character not found: ${characterId}`);
        }

        await this.characterRepo.addToMedia(
          mediaId,
          character.id,
          undefined,
          undefined,
          tx,
        );

        await this.linkCharacterIps(mediaId, character, tx);
      },
    );
  }

  async linkCharacterIps(
    mediaId: string,
    character: Character,
    tx?: Transaction,
  ): Promise<void> {
    if (character.ips && character.ips.length > 0) {
      await this.ipRepo.addMediaBulk(
        mediaId,
        character.ips.map((ip) => ({ id: ip.id })),
        "character_link",
        tx,
      );
    }
  }

  async removeCharacterFromMedia(
    mediaId: string,
    characterId: string,
  ): Promise<void> {
    await this.characterRepo.removeFromMedia(mediaId, characterId);
  }
}
