import type { MediaSource } from "~/db/schema";
import { localConnectionSchema } from "~/lib/schemas";
import { LocalDriver } from "./local";
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
    default:
      // `source.type` is `never` here, ensuring all cases are handled.
      throw new Error(`メディアソースタイプが不明です: ${source.type}`);
  }
}
