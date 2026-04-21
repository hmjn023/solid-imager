import { createCharacterService } from "@solid-imager/application/services/character-service";
import type {
	Character,
	NewCharacter,
	UpdateCharacter,
} from "@solid-imager/core/domain/characters/schemas";
import type { Transaction } from "@solid-imager/core/domain/interfaces/transaction-manager";
import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import { getTauriAppServices } from "~/app-services";
import type { TauriDbExecutor } from "~/infrastructure/db/client";
import { TauriCharacterRepository } from "../repositories/character-repository";
import { TauriIpRepository } from "../repositories/ip-repository";

const characterRepository: CharacterRepository = {
	...TauriCharacterRepository,
	addToMedia: TauriCharacterRepository.addMedia,
	removeFromMedia: TauriCharacterRepository.removeMedia,
	async getMediaCharacters(mediaId: string) {
		const characters = await TauriCharacterRepository.findByMediaId(mediaId);
		return characters.map((character) => ({
			...character,
			confidence: null,
			associationSource: "manual",
		}));
	},
	async addToMediaBulk(
		mediaId: string,
		characters: { id: string; confidence?: number }[],
		source = "manual",
		tx?: Transaction,
	) {
		for (const character of characters) {
			await TauriCharacterRepository.addMedia(
				mediaId,
				character.id,
				character.confidence,
				source,
				tx as TauriDbExecutor | undefined,
			);
		}
	},
};

const characterService = createCharacterService({
	characterRepository,
	ipRepository: TauriIpRepository,
	defaultAssociationSource: "manual",
	transactionManager: {
		async transaction<T>(
			callback: (tx: Transaction) => Promise<T>,
		): Promise<T> {
			return await getTauriAppServices().db.transaction(callback);
		},
	},
});

export const TauriCharacterService = {
	async list(): Promise<Character[]> {
		return await characterService.getAllCharacters();
	},

	async get(id: string): Promise<Character | null> {
		return await characterService.getCharacterDetails(id);
	},

	async create(input: NewCharacter): Promise<Character> {
		return await characterService.createCharacter(input);
	},

	async update(id: string, input: UpdateCharacter): Promise<Character> {
		return await characterService.updateCharacter(id, input);
	},

	async delete(id: string): Promise<void> {
		await characterService.deleteCharacter(id);
	},

	async listForMedia(mediaId: string): Promise<Character[]> {
		return await characterService.getCharactersForMedia(mediaId);
	},

	async addToMedia(mediaId: string, characterId: string): Promise<void> {
		await characterService.addCharacterToMedia(mediaId, characterId);
	},

	async removeFromMedia(mediaId: string, characterId: string): Promise<void> {
		await characterService.removeCharacterFromMedia(mediaId, characterId);
	},
};
