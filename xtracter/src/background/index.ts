import { DownloadBulkMessage, DownloadMessage, ExtendedMessage, PostBulkMessage, PostDownloadMessage, TweetMetadata } from '../types';
import { getClient, APIError } from '../api';
import type { SafeMediaSource } from '~/domain/sources/schemas';

console.log('[xtracter] Background script loaded');

/**
 * リトライ付きでAPI呼び出しを実行する
 */
async function retryWithBackoff<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelay = 1000
): Promise<T> {
    let lastError: unknown;

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;

            // タイムアウトやネットワークエラーの場合のみリトライ
            if (error instanceof APIError &&
                (error.code === 'TIMEOUT' || error.code === 'NETWORK_ERROR')) {

                if (attempt < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, attempt);
                    console.warn(
                        `[xtracter] API call failed (attempt ${attempt + 1}/${maxRetries}), ` +
                        `retrying in ${delay}ms...`,
                        error.message
                    );
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
            }

            // その他のエラーは即座に失敗
            throw error;
        }
    }

    throw lastError;
}

// Fetch sources from API
async function getMediaSources(): Promise<SafeMediaSource[]> {
    try {
        // console.log('[xtracter] Fetching media sources...');

        const sources = await retryWithBackoff(async () => {
            const client = await getClient();
            return await client.sources.list();
        });

        // console.log(`[xtracter] Successfully fetched ${sources.length} media sources`);
        return sources as SafeMediaSource[];
    } catch (error) {
        if (error instanceof APIError) {
            // console.error(
            //     `[xtracter] Failed to fetch media sources: ${error.message}`,
            //     `\nError code: ${error.code}`,
            //     error.originalError
            // );
        } else {
            // console.error('[xtracter] Unexpected error fetching media sources:', error);
        }
        return [];
    }
}

// Determine which source ID to use
async function getTargetSourceId(): Promise<string | null> {
    // 1. Check local storage for user selection
    const result = await chrome.storage.local.get(['selectedSourceId']);
    if (result.selectedSourceId) {
        return result.selectedSourceId;
    }

    // 2. Fallback: Try to find 'twitter' or use the first one (and save it?)
    // For now, let's just dynamic fetch if nothing is saved, but don't save it automatically to avoid confusion
    const sources = await getMediaSources();
    const twitterSource = sources.find(s => s.name === 'twitter');
    if (twitterSource?.id) return twitterSource.id;
    if (sources.length > 0 && sources[0].id) return sources[0].id;

    return null;
}

async function postDownloads(items: TweetMetadata[]) {
    const mediaSourceId = await getTargetSourceId();
    if (!mediaSourceId) {
        const errorMsg = 'No valid media source found (and none selected in settings)';
        console.error(`[xtracter] ${errorMsg}`);

        // ユーザーに通知
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'xtracter Error',
            message: 'No media source configured. Please set one in the extension popup.'
        });
        return;
    }

    try {
        console.log(`[xtracter] Posting ${items.length} downloads to source ${mediaSourceId}...`);
        console.log(`[xtracter] Items:`, items.map(item => ({
            imageUrl: item.imageUrl,
            tweetUrl: item.tweetUrl,
            hasCookies: !!item.cookies,
            hasUserAgent: !!item.userAgent,
        })));

        const result = await retryWithBackoff(async () => {
            const client = await getClient();
            return await client.downloads.start({
                mediaSourceId,
                items: items.map(item => ({
                    ...item,
                    tweetUrl: item.tweetUrl || undefined,
                    tweetText: item.tweetText || undefined,
                    timestamp: item.timestamp || undefined,
                    authorName: item.authorName || undefined,
                    authorId: item.authorId || undefined,
                }))
            });
        });

        console.log('[xtracter] Download job queued successfully:', result);

        // 成功通知
        chrome.notifications.create({
            type: 'basic',
            iconUrl: 'icon.png',
            title: 'xtracter',
            message: `Successfully queued ${items.length} download(s)`
        });
    } catch (error) {
        if (error instanceof APIError) {
            console.error(
                `[xtracter] Failed to post download job: ${error.message}`,
                `\nError code: ${error.code}`,
                `\nItems count: ${items.length}`,
                error.originalError
            );

            // エラー通知
            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'xtracter Error',
                message: `Failed to queue downloads: ${error.message}`
            });
        } else {
            console.error('[xtracter] Unexpected error posting download job:', error);

            chrome.notifications.create({
                type: 'basic',
                iconUrl: 'icon.png',
                title: 'xtracter Error',
                message: 'An unexpected error occurred. Check console for details.'
            });
        }
    }
}

// Type Guard Functions
function isDownloadMessage(msg: ExtendedMessage): msg is DownloadMessage {
    return msg.type === 'DOWNLOAD';
}

function isDownloadBulkMessage(msg: ExtendedMessage): msg is DownloadBulkMessage {
    return msg.type === 'DOWNLOAD_BULK';
}

function isPostDownloadMessage(msg: ExtendedMessage): msg is PostDownloadMessage {
    return msg.type === 'POST_DOWNLOAD';
}

function isPostBulkMessage(msg: ExtendedMessage): msg is PostBulkMessage {
    return msg.type === 'POST_BULK';
}

function isGetCookiesMessage(msg: ExtendedMessage): msg is { type: 'GET_COOKIES', url: string } {
    return msg.type === 'GET_COOKIES';
}


chrome.runtime.onMessage.addListener((message: ExtendedMessage, _sender, sendResponse) => {
    // Handle Popup Requests
    if (message.type === 'GET_SOURCES') {
        getMediaSources().then(sources => sendResponse(sources));
        return true; // Async response
    }

    if (isGetCookiesMessage(message)) {
        const url = message.url;
        if (!url) {
            sendResponse([]);
            return;
        }
        chrome.cookies.getAll({ url }, (cookies) => {
            sendResponse(cookies);
        });
        return true;
    }

    if (message.type === 'DOWNLOAD_JSON_FROM_POPUP') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const activeTab = tabs[0];
            if (activeTab?.id) {
                chrome.tabs.sendMessage(activeTab.id, { type: 'GET_METADATA' }, (response) => {
                    if (chrome.runtime.lastError) {
                        console.error('Could not get metadata from content script:', chrome.runtime.lastError);
                        return;
                    }

                    if (response && Array.isArray(response)) {
                        // Reuse the bulk download logic
                        const now = new Date();
                        const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
                        const filename = `xtracter/xtracter-${dateStr}.json`;
                        const jsonString = JSON.stringify(response, null, 2);
                        const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonString)));
                        chrome.downloads.download({
                            url: dataUrl,
                            filename: filename
                        });
                    }
                });
            }
        });
        return true;
    }

    // Handle Content Script Requests
    if (isDownloadMessage(message)) {
        // ... existing download logic ...
        const { imageUrl, authorId, timestamp } = message.data;
        const safeAuthorId = authorId.replace(/[^a-zA-Z0-9@_-]/g, '');
        const safeTimestamp = new Date(timestamp).getTime();
        const filenameBase = `xtracter/${safeAuthorId}_${safeTimestamp}`;
        chrome.downloads.download({
            url: imageUrl,
            filename: `${filenameBase}.png`
        });
    } else if (isDownloadBulkMessage(message)) {
        // ... existing bulk download logic ...
        const now = new Date();
        const dateStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `xtracter/xtracter-${dateStr}.json`;
        const jsonString = JSON.stringify(message.data, null, 2);
        const dataUrl = 'data:application/json;base64,' + btoa(unescape(encodeURIComponent(jsonString)));
        chrome.downloads.download({
            url: dataUrl,
            filename: filename
        });
    } else if (isPostDownloadMessage(message)) {
        postDownloads([message.data]);
    } else if (isPostBulkMessage(message)) {
        postDownloads(message.data);
    }

    return true;
});
