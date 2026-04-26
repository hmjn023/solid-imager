import { createIpRepository } from "@solid-imager/db/repositories/ip-repository";
import { getTauriDrizzleExecutor } from "./drizzle-executor";

export const TauriIpRepository = createIpRepository(getTauriDrizzleExecutor, {
	orderByName: true,
});
