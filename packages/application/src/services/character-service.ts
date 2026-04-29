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

export type CharacterServiceDeps = {
	characterRepository: CharacterRepository;
	ipRepository: IIpRepository;
	transactionManager: TransactionManager;
	defaultAssociationSource?: string;
};

export class CharacterServiceImpl {
	readonly characterRepo: CharacterRepository;
	private readonly ipRepo: IIpRepository;
	private readonly transactionManager: TransactionManager;
	private readonly defaultAssociationSource: string | undefined;

	constructor({
		characterRepository,
		ipRepository,
		transactionManager,
		defaultAssociationSource,
	}: CharacterServiceDeps) {
		this.characterRepo = characterRepository;
		this.ipRepo = ipRepository;
		this.transactionManager = transactionManager;
		this.defaultAssociationSource = defaultAssociationSource;
	}

	async getAllCharacters(): Promise<Character[]> {
		return await this.characterRepo.findAll();
	}

	async createCharacter(input: NewCharacter): Promise<Character> {
		return await this.characterRepo.create(input);
	}

	async findByName(name: string): Promise<Character | null> {
		return await this.characterRepo.findByName(name);
	}

	async getCharacterDetails(id: string): Promise<Character | null> {
		return await this.characterRepo.findById(id);
	}

	async updateCharacter(
		id: string,
		input: UpdateCharacter,
	): Promise<Character> {
		return await this.characterRepo.update(id, input);
	}

	async deleteCharacter(id: string): Promise<void> {
		await this.characterRepo.delete(id);
	}

	async getCharactersForMedia(mediaId: string): Promise<Character[]> {
		return await this.characterRepo.findByMediaId(mediaId);
	}

	async addCharacterToMedia(
		mediaId: string,
		characterId: string,
	): Promise<void> {
		await this.transactionManager.transaction(async (tx: Transaction) => {
			const character = await this.characterRepo.findById(characterId, tx);
			if (!character) {
				throw new Error(`Character not found: ${characterId}`);
			}

			await this.characterRepo.addToMedia(
				mediaId,
				character.id,
				undefined,
				this.defaultAssociationSource,
				tx,
			);

			await this.linkCharacterIps(mediaId, character, tx);
		});
	}

	async linkCharacterIps(
		mediaId: string,
		character: Character,
		tx?: Transaction,
	): Promise<void> {
		if (!character.ips || character.ips.length === 0) {
			return;
		}

		for (const ip of character.ips) {
			await this.ipRepo.addMedia(
				mediaId,
				ip.id,
				undefined,
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

export function createCharacterService(deps: CharacterServiceDeps) {
	return new CharacterServiceImpl(deps);
}
