import { cache } from "@solidjs/router";
import type { MediaSourceTypeEnum } from "~/domain/sources/types";
import type { MediaSource, NewMediaSource } from "~/infrastructure/db/schema";

/**
 * Custom error class for fetch operations.
 * @property {string} _tag - A unique identifier for the error type.
 * @property {string} message - A human-readable error message.
 * @property {number} [status] - The HTTP status code associated with the error, if applicable.
 */
export class FetchError {
  readonly _tag = "FetchError";
  readonly message: string;
  readonly status?: number;
  constructor(message: string, status?: number) {
    this.message = message;
    this.status = status;
  }
}
/**
 * Represents the data required to create a new media source.
 * @property {string} name - The name of the media source.
 * @property {string | null} description - A description of the media source.
 * @property {MediaSourceTypeEnum} type - The type of the media source (e.g., "local", "sftp", "s3").
 * @property {{ path: string }} connectionInfo - Connection details for the media source.
 * @property {string} connectionInfo.path - The path for the connection (e.g., local directory path).
 */
export type CreateSourceData = {
  name: string;
  description: string | null;
  type: MediaSourceTypeEnum;
  connectionInfo: { path: string };
};
/**
 * Represents the data required to update an existing media source.
 * This type alias is used to ensure consistency between create and update operations.
 */
export type UpdateSourceData = CreateSourceData;

/**
 * Fetches all media sources from the database.
 * This function is intended to be executed on the server.
 * The result is cached.
 * @returns {Promise<MediaSource[]>} A promise that resolves to an array of media sources.
 */
const fetchSourcesServer = cache(async (): Promise<MediaSource[]> => {
  "use server";
  const { selectMediaSources } = await import(
    "~/infrastructure/db/queries/media-sources"
  );
  return selectMediaSources();
}, "fetchSources");

/**
 * Inserts a new media source into the database.
 * This function is intended to be executed on the server.
 * @param {NewMediaSource} sourceData - The data for the new media source to create.
 * @returns {Promise<MediaSource[]>} A promise that resolves to an array containing the newly created media source.
 */
const createSourceServer = async (
  sourceData: NewMediaSource
): Promise<MediaSource[]> => {
  "use server";
  const { insertMediaSource } = await import(
    "~/infrastructure/db/queries/media-sources"
  );
  return insertMediaSource(sourceData);
};

/**
 * Updates an existing media source in the database.
 * This function is intended to be executed on the server.
 * @param {string} mediaSourceId - The UUID of the media source to update.
 * @param {MediaSource} sourceData - An object containing the updated data for the media source.
 * @returns {Promise<MediaSource[]>} A promise that resolves to an array containing the updated media source.
 */
const updateSourceServer = async (
  mediaSourceId: string,
  sourceData: MediaSource
): Promise<MediaSource[]> => {
  "use server";
  const { updateMediaSource } = await import(
    "~/infrastructure/db/queries/media-sources"
  );
  return updateMediaSource(mediaSourceId, sourceData);
};

/**
 * Fetches a single media source by its UUID from the database.
 * This function is intended to be executed on the server.
 * The result is cached.
 * @param {string} mediaSourceId - The UUID of the media source to fetch.
 * @returns {Promise<(MediaSource | undefined)[]>} A promise that resolves to an array containing the media source if found, otherwise undefined.
 */
const fetchSourceByIdServer = cache(
  async (mediaSourceId: string): Promise<(MediaSource | undefined)[]> => {
    "use server";
    const { selectMediaSourceById } = await import(
      "~/infrastructure/db/queries/media-sources"
    );
    return selectMediaSourceById(mediaSourceId);
  },
  "fetchSourceById"
);

/**
 * Deletes a media source from the database by its UUID.
 * This function is intended to be executed on the server.
 * @param {string} mediaSourceId - The UUID of the media source to delete.
 * @returns {Promise<MediaSource[]>} A promise that resolves to an array containing the deleted media source.
 */
const deleteSourceServer = async (
  mediaSourceId: string
): Promise<MediaSource[]> => {
  "use server";
  const { deleteMediaSource } = await import(
    "~/infrastructure/db/queries/media-sources"
  );
  return deleteMediaSource(mediaSourceId);
};

/**
 * Provides services for managing media sources, including fetching, creating, updating, and deleting.
 */
export const MediaSourceService = {
  /**
   * Fetches all media sources from the server.
   * This function is cached and executed only on the server side.
   * @returns {Promise<MediaSource[]>} A promise that resolves with an array of media sources.
   */
  fetchSources: fetchSourcesServer,
  /**
   * Creates a new media source on the server.
   * This function is executed only on the server side.
   * @param {NewMediaSource} sourceData - The data for the new media source.
   * @returns {Promise<MediaSource[]>} A promise that resolves with an array containing the newly created media source.
   */
  createSource: createSourceServer,
  /**
   * Updates an existing media source on the server.
   * This function is executed only on the server side.
   * @param {string} mediaSourceId - The ID of the media source to update.
   * @param {MediaSource} sourceData - The updated data for the media source.
   * @returns {Promise<MediaSource[]>} A promise that resolves with an array containing the updated media source.
   */
  updateSource: updateSourceServer,
  /**
   * Fetches a specific media source by its ID from the server.
   * This function is cached and executed only on the server side.
   * @param {string} mediaSourceId - The ID of the media source to fetch.
   * @returns {Promise<(MediaSource | undefined)[]>} A promise that resolves with an array containing the media source, or undefined if not found.
   */
  fetchSourceById: fetchSourceByIdServer,
  /**
   * Deletes a media source from the server.
   * This function is executed only on the server side.
   * @param {string} mediaSourceId - The ID of the media source to delete.
   * @returns {Promise<MediaSource[]>} A promise that resolves with an array containing the deleted media source.
   */
  deleteSource: deleteSourceServer,
};
