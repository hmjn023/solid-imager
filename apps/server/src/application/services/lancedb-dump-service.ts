import { createLanceDbDumpService } from "@solid-imager/application/services/lancedb-dump-service";
export type { MediaDumpItemWithImageData } from "@solid-imager/application/ports/lancedb-dump-service";
import { logger } from "~/infrastructure/logger";

const service = createLanceDbDumpService({
	logger: {
		info: (msg: string, data?: unknown) => logger.info(data, msg),
		error: (msg: string, data?: unknown) => logger.error(data, msg),
	},
});

export const writeToLanceDB = service.writeToLanceDB;
export const readFromLanceDB = service.readFromLanceDB;
export const cleanupLanceDBDir = service.cleanupLanceDBDir;
