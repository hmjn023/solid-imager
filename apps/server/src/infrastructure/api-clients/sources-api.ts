import { createSourcesApi } from "@solid-imager/core/interfaces/media-manager-client";
import { serverSourcesApiContract } from "./app-client";

const sourcesApi = createSourcesApi(serverSourcesApiContract);

export const fetchMediaSources = sourcesApi.fetchMediaSources;
export const fetchMediaSource = sourcesApi.fetchMediaSource;
export const createMediaSource = sourcesApi.createMediaSource;
export const updateMediaSource = sourcesApi.updateMediaSource;
export const deleteMediaSource = sourcesApi.deleteMediaSource;
export const syncMediaSources = sourcesApi.syncMediaSources;
export const fetchSourceDump = sourcesApi.fetchSourceDump;
export const restoreSource = sourcesApi.restoreSource;
export const importSourceZip = sourcesApi.importSourceZip;
