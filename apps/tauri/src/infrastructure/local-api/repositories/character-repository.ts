import { createCharacterRepository } from "@solid-imager/db/repositories/character-repository";
import type { DrizzleExecutor } from "@solid-imager/db/types";
import { getTauriAppServices } from "~/app-services";

function getExecutor(tx?: unknown): DrizzleExecutor {
	return (tx ?? getTauriAppServices().db) as DrizzleExecutor;
}

const repository = createCharacterRepository(getExecutor, {
	orderByName: true,
	throwOnMissingRemove: true,
	transaction: (callback) =>
		getTauriAppServices().db.transaction((tx) => callback(tx)),
});

export const TauriCharacterRepository = {
	...repository,
	addMedia: repository.addToMedia,
	removeMedia: repository.removeFromMedia,
};
