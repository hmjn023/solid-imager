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

	async list(): Promise<Character[]> {
		return await this.service.list();
	}

	async create(data: NewCharacter): Promise<Character> {
		return await this.service.create(data);
	}

	async findByName(name: string): Promise<Character | null> {
		return await this.service.findByName(name);
	}

	async get(id: string): Promise<Character | undefined> {
		const result = await this.service.get(id);
		return result ?? undefined;
	}

	async update(id: string, data: UpdateCharacter): Promise<Character> {
		return await this.service.update(id, data);
	}

	async delete(id: string): Promise<{ success: true }> {
		await this.service.delete(id);
		return { success: true };
	}

	async listForMedia(mediaId: string): Promise<Character[]> {
		return await this.service.listForMedia(mediaId);
	}

	async addToMedia(mediaId: string, characterId: string): Promise<void> {
		return await this.service.addToMedia(mediaId, characterId);
	}

	linkCharacterIps(
		...args: Parameters<SharedCharacterServiceImpl["linkCharacterIps"]>
	): ReturnType<SharedCharacterServiceImpl["linkCharacterIps"]> {
		return this.service.linkCharacterIps(...args);
	}

	async removeFromMedia(mediaId: string, characterId: string): Promise<void> {
		await this.service.removeFromMedia(mediaId, characterId);
	}
}

// Backward compatibility proxy
export const CharacterService = {
	list: async () => services.getCharacterService().list(),
	create: async (data: NewCharacter) =>
		services.getCharacterService().create(data),
	findByName: async (name: string) =>
		services.getCharacterService().findByName(name),
	get: async (id: string) => services.getCharacterService().get(id),
	update: async (id: string, data: UpdateCharacter) =>
		services.getCharacterService().update(id, data),
	delete: async (id: string) => services.getCharacterService().delete(id),
	listForMedia: async (mediaId: string) =>
		services.getCharacterService().listForMedia(mediaId),
	addToMedia: async (mediaId: string, characterId: string) =>
		services.getCharacterService().addToMedia(mediaId, characterId),
	removeFromMedia: async (mediaId: string, characterId: string) =>
		services.getCharacterService().removeFromMedia(mediaId, characterId),
};
