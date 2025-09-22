import type { MediaSource } from "~/db/schema";
import {
	localConnectionSchema,
	s3ConnectionSchema,
	sftpConnectionSchema,
} from "~/lib/schemas";
import { LocalDriver } from "./local";
import { S3Driver } from "./s3";
import { SftpDriver } from "./sftp";
import type { MediaSourceDriver } from "./types";

/**
 * Returns a driver instance for the given media source.
 * @param source The media source from the database.
 * @returns An instance of a class that implements the MediaSourceDriver interface.
 * @throws An error if the media source type is unknown or the connection info is invalid.
 */
export function getDriver(source: MediaSource): MediaSourceDriver {
	switch (source.type) {
		case "local": {
			const connectionInfo = localConnectionSchema.parse(source.connectionInfo);
			return new LocalDriver(connectionInfo);
		}
		case "sftp": {
			const connectionInfo = sftpConnectionSchema.parse(source.connectionInfo);
			return new SftpDriver(connectionInfo);
		}
		case "s3": {
			const connectionInfo = s3ConnectionSchema.parse(source.connectionInfo);
			return new S3Driver(connectionInfo);
		}
		default:
			// `source.type` is `never` here, ensuring all cases are handled.
			throw new Error(`メディアソースタイプが不明です: ${source.type}`);
	}
}
