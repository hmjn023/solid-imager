export interface Author {
    name: string;
    accountId?: string | null;
}

export interface DownloadItem {
    // Required for download
    targetUrl: string;
    
    // Metadata
    description?: string | null;
    createdAt?: string; // ISO string
    
    // Relations
    sourceUrls?: string[];
    authors?: Author[];
    
    // Technical
    cookies?: any[];
    userAgent?: string;
}

// Alias for backward compatibility during refactor, or we can just replace usage.
export type TweetMetadata = DownloadItem;

export interface DownloadMessage {
    type: 'DOWNLOAD';
    data: TweetMetadata;
}

export interface DownloadBulkMessage {
    type: 'DOWNLOAD_BULK';
    data: TweetMetadata[];
}

export interface PostDownloadMessage {
    type: 'POST_DOWNLOAD';
    data: TweetMetadata;
}

export interface PostBulkMessage {
    type: 'POST_BULK';
    data: TweetMetadata[];
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

export type Message = DownloadMessage | DownloadBulkMessage | PostDownloadMessage | PostBulkMessage;
export type ExtendedMessage = Message | GetSourcesMessage | GetMetadataMessage | DownloadJsonMessage | GetCookiesMessage;
