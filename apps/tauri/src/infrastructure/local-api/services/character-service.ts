import type {
	Character,
	NewCharacter,
	UpdateCharacter,
} from "@solid-imager/core/domain/characters/schemas";
import { getTauriAppServices } from "~/app-services";
import { TauriCharacterRepository } from "../repositories/character-repository";
import { TauriIpRepository } from "../repositories/ip-repository";

export const TauriCharacterService = {
	async list(): Promise<Character[]> {
		return await TauriCharacterRepository.findAll();
	},

	async get(id: string): Promise<Character | null> {
		return await TauriCharacterRepository.findById(id);
	},

	async create(input: NewCharacter): Promise<Character> {
		return await TauriCharacterRepository.create(input);
	},

	async update(id: string, input: UpdateCharacter): Promise<Character> {
		return await TauriCharacterRepository.update(id, input);
	},

	async delete(id: string): Promise<void> {
		await TauriCharacterRepository.delete(id);
	},

	async listForMedia(mediaId: string): Promise<Character[]> {
		return await TauriCharacterRepository.findByMediaId(mediaId);
	},

	async addToMedia(mediaId: string, characterId: string): Promise<void> {
		await getTauriAppServices().db.transaction(async (tx) => {
			const character = await TauriCharacterRepository.findById(characterId, tx);
			if (!character) {
				throw new Error(`Character not found: ${characterId}`);
			}

			await TauriCharacterRepository.addMedia(mediaId, characterId, undefined, "manual", tx);

			for (const ip of character.ips) {
				await TauriIpRepository.addMedia(mediaId, ip.id, undefined, "character_link", tx);
			}
		});
	},

	async removeFromMedia(mediaId: string, characterId: string): Promise<void> {
		await TauriCharacterRepository.removeMedia(mediaId, characterId);
	},
};
