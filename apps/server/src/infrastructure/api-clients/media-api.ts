import { createMediaApi } from "@solid-imager/core/interfaces/media-manager-client";
import { serverMediaApiContract } from "./app-client";

const mediaApi = createMediaApi(serverMediaApiContract);

export const fetchMediaList = mediaApi.fetchMediaList;
export const fetchMediaListInfinite = mediaApi.fetchMediaListInfinite;
export const fetchMediaDetails = mediaApi.fetchMediaDetails;
export const uploadMedia = mediaApi.uploadMedia;
export const updateMedia = mediaApi.updateMedia;
export const deleteMedia = mediaApi.deleteMedia;
export const copyMedia = mediaApi.copyMedia;
export const moveMedia = mediaApi.moveMedia;
export const syncMediaItems = mediaApi.syncMediaItems;
export const startDownloadJobs = mediaApi.startDownloadJobs;
