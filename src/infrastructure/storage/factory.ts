/**
 * Storage Driver Factory
 * Extracted from src/lib/drivers/factory.ts
 */

import {
  localConnectionSchema,
  nextcloudConnectionSchema,
} from "~/domain/sources/schemas";
import type { MediaSource } from "~/infrastructure/db/schema";
import { LocalDriver } from "./local";
import { NextcloudDriver } from "./nextcloud";
import type { MediaSourceDriver } from "./types";

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
    case "nextcloud": {
      const connectionInfo = nextcloudConnectionSchema.parse(
        source.connectionInfo
      );
      return new NextcloudDriver(connectionInfo);
    }
    default:
      throw new Error(`メディアソースタイプが不明です: ${source.type}`);
  }
}
