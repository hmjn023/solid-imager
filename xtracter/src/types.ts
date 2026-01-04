export interface TweetMetadata {
    imageUrl: string;
    tweetUrl: string;
    tweetText: string;
    timestamp: string;
    authorName: string;
    authorId: string;
}

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

export interface GetMetadataMessage {
    type: 'GET_METADATA';
}

export interface DownloadJsonMessage {
    type: 'DOWNLOAD_JSON_FROM_POPUP';
}

export type Message = DownloadMessage | DownloadBulkMessage | PostDownloadMessage | PostBulkMessage;
export type ExtendedMessage = Message | GetSourcesMessage | GetMetadataMessage | DownloadJsonMessage;