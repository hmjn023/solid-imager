import { createTagRepository } from "@solid-imager/db/repositories/tag-repository";
import { getTauriAppServices } from "~/app-services";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriTagRepository = createTagRepository(getTauriDrizzleExecutor, {
	orderByName: true,
	transaction: (callback) =>
		getTauriAppServices().db.transaction((tx) => callback(tx)),
});
