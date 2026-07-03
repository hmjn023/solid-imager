import {
	createLanceDbDumpService,
	LANCEDB_DUMP_VERSION,
} from "@solid-imager/application/services/lancedb-dump-service";

export type { MediaDumpItemWithImageData } from "@solid-imager/application/ports/lancedb-dump-service";
export { LANCEDB_DUMP_VERSION };

import { logger } from "~/infrastructure/logger";

// LanceDB メモリプールサイズはアプリケーションエントリポイントで設定
process.env.LANCE_MEM_POOL_SIZE ??= "536870912";

const service = createLanceDbDumpService({
	logger: {
		info: (msg: string, data?: unknown) => logger.info(data, msg),
		error: (msg: string, data?: unknown) => logger.error(data, msg),
	},
});

export const writeToLanceDB = service.writeToLanceDB;
export const syncLanceDB = service.syncLanceDB;
export const syncLanceDBPages = service.syncLanceDBPages;
export const syncLanceDBDelta = service.syncLanceDBDelta;
export const readFromLanceDB = service.readFromLanceDB;
export const readMediaIds = service.readMediaIds;
export const readMediaFilePaths = service.readMediaFilePaths;
export const cleanupLanceDBDir = service.cleanupLanceDBDir;
