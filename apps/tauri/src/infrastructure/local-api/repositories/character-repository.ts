import { createCharacterRepository } from "@solid-imager/db/repositories/character-repository";
import { getTauriAppServices } from "~/app-services";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

const repository = createCharacterRepository(getTauriDrizzleExecutor, {
	orderByName: true,
	throwOnMissingRemove: true,
	transaction: (callback) => getTauriAppServices().db.transaction((tx) => callback(tx)),
});

export const TauriCharacterRepository = {
	...repository,
	addMedia: repository.addToMedia,
	removeMedia: repository.removeFromMedia,
};
