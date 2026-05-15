/**
 * Storage Driver Factory
 * Extracted from src/lib/drivers/factory.ts
 */

import { localConnectionSchema } from "@solid-imager/core/domain/sources/schemas";
import type { MediaSource } from "@solid-imager/db/schema";
import { LocalDriver } from "./local";
import type { MediaSourceDriver } from "./schema";

/**
 * Returns a driver instance for the specified media source.
 * @param {MediaSource} source - The media source object from the database.
 * @returns {MediaSourceDriver} An instance of a class implementing the MediaSourceDriver interface.
 * @throws {Error} If the media source type is unknown or connection information is invalid.
 */
export function getDriver(source: MediaSource): MediaSourceDriver {
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
