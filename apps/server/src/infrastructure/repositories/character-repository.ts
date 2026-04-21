import type { CharacterRepository } from "@solid-imager/core/domain/repositories/character-repository";
import { createCharacterRepository } from "@solid-imager/db/repositories/character-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { db } from "~/infrastructure/db/index";

export class DrizzleCharacterRepository implements CharacterRepository {
	private readonly repository = createCharacterRepository(
		(tx) => (tx ?? db) as DrizzleExecutor,
		{
			transaction: (callback) => db.transaction((tx) => callback(tx)),
		},
	);

	findAll: CharacterRepository["findAll"] = () => this.repository.findAll();

	findById: CharacterRepository["findById"] = (id, tx) =>
		this.repository.findById(id, tx);

	findByName: CharacterRepository["findByName"] = (name, tx) =>
		this.repository.findByName(name, tx);

	create: CharacterRepository["create"] = (character, tx) =>
		this.repository.create(character, tx);

	update: CharacterRepository["update"] = (id, character, tx) =>
		this.repository.update(id, character, tx);

	delete: CharacterRepository["delete"] = (id, tx) =>
		this.repository.delete(id, tx);

	findByMediaId: CharacterRepository["findByMediaId"] = (mediaId, tx) =>
		this.repository.findByMediaId(mediaId, tx);

	getMediaCharacters: CharacterRepository["getMediaCharacters"] = (
		mediaId,
		tx,
	) => this.repository.getMediaCharacters(mediaId, tx);

	addToMedia: CharacterRepository["addToMedia"] = (
		mediaId,
		characterId,
		confidence,
		source,
		tx,
	) => this.repository.addToMedia(mediaId, characterId, confidence, source, tx);

	removeFromMedia: CharacterRepository["removeFromMedia"] = (
		mediaId,
		characterId,
		tx,
	) => this.repository.removeFromMedia(mediaId, characterId, tx);

	addToMediaBulk: CharacterRepository["addToMediaBulk"] = (
		mediaId,
		characters,
		source,
		tx,
	) => this.repository.addToMediaBulk(mediaId, characters, source, tx);
}
