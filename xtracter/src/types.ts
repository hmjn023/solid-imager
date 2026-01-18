import type { ImportItem } from "~/domain/media/import-schemas";

export type { ImportItem };

export interface DownloadMessage {
    type: 'DOWNLOAD';
    data: ImportItem;
}

export interface DownloadBulkMessage {
    type: 'DOWNLOAD_BULK';
    data: ImportItem[];
}

export interface PostDownloadMessage {
    type: 'POST_DOWNLOAD';
    data: ImportItem;
}

export interface PostBulkMessage {
    type: 'POST_BULK';
    data: ImportItem[];
}

export interface PostPreviewMessage {
    type: 'POST_PREVIEW';
    data: ImportItem[];
}

export interface MediaSource {
    id: string;
    name: string;
    type: string;
}

export interface GetSourcesMessage {
    type: 'GET_SOURCES';
}

export interface GetCookiesMessage {
    type: 'GET_COOKIES';
    url: string;
}

export interface GetMetadataMessage {
    type: 'GET_METADATA';
}

export interface DownloadJsonMessage {
    type: 'DOWNLOAD_JSON_FROM_POPUP';
}

export type Message = DownloadMessage | DownloadBulkMessage | PostDownloadMessage | PostBulkMessage | PostPreviewMessage;
export type ExtendedMessage = Message | GetSourcesMessage | GetMetadataMessage | DownloadJsonMessage | GetCookiesMessage;