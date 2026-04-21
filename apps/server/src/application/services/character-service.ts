import {
	createCharacterService,
	type CharacterServiceImpl as SharedCharacterServiceImpl,
} from "@solid-imager/application/services/character-service";
import type {
	Character,
	NewCharacter,
	UpdateCharacter,
} from "@solid-imager/core/domain/characters/schemas";
import type { TransactionManager } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import type { IIpRepository } from "@solid-imager/core/domain/repositories/ip-repository";
import { services } from "~/application/registry";

export class CharacterServiceImpl {
	readonly characterRepo: CharacterRepository;
	private readonly service: SharedCharacterServiceImpl;

	constructor(
		characterRepo: CharacterRepository,
		ipRepo: IIpRepository,
		transactionManager: TransactionManager,
	) {
		this.characterRepo = characterRepo;
		this.service = createCharacterService({
			characterRepository: characterRepo,
			ipRepository: ipRepo,
			transactionManager,
		});
	}

	async getAllCharacters(): Promise<Character[]> {
		return await this.service.getAllCharacters();
	}

	async createCharacter(data: NewCharacter): Promise<Character> {
		return await this.service.createCharacter(data);
	}

	async findByName(name: string): Promise<Character | null> {
		return await this.service.findByName(name);
	}

	async getCharacterDetails(id: string): Promise<Character | undefined> {
		const result = await this.service.getCharacterDetails(id);
		return result ?? undefined;
	}

	async updateCharacter(id: string, data: UpdateCharacter): Promise<Character> {
		return await this.service.updateCharacter(id, data);
	}

	async deleteCharacter(id: string): Promise<{ success: true }> {
		await this.service.deleteCharacter(id);
		return { success: true };
	}

	async getCharactersForMedia(mediaId: string): Promise<Character[]> {
		return await this.service.getCharactersForMedia(mediaId);
	}

	async addCharacterToMedia(
		mediaId: string,
		characterId: string,
	): Promise<void> {
		return await this.service.addCharacterToMedia(mediaId, characterId);
	}

	linkCharacterIps(
		...args: Parameters<SharedCharacterServiceImpl["linkCharacterIps"]>
	): ReturnType<SharedCharacterServiceImpl["linkCharacterIps"]> {
		return this.service.linkCharacterIps(...args);
	}

	async removeCharacterFromMedia(
		mediaId: string,
		characterId: string,
	): Promise<void> {
		await this.service.removeCharacterFromMedia(mediaId, characterId);
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
