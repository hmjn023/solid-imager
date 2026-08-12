/**
 * Storage Driver Factory
 * Extracted from src/lib/drivers/factory.ts
 */

import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import { LocalDriver } from "./local";
import type { MediaSourceDriver } from "./schema";

type DriverSource = {
	type: "local" | "sftp" | "s3";
	connectionInfo: unknown;
};

/**
 * Returns a driver instance for the specified media source.
 * @param {MediaSource} source - The media source object from the database.
 * @returns {MediaSourceDriver} An instance of a class implementing the MediaSourceDriver interface.
 * @throws {Error} If the media source type is unknown or connection information is invalid.
 */
export function getDriver(source: DriverSource): MediaSourceDriver {
	switch (source.type) {
		case "local": {
			const connectionInfo = localConnectionSchema.parse(source.connectionInfo);
			return new LocalDriver(connectionInfo);
		}
		default:
			// ここで`source.type`は`never`であり、すべてのケースが処理されることを保証します。
			throw new Error(`メディアソースタイプが不明です: ${source.type}`);
	}
}
