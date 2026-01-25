import { TweetMetadata, Author } from '../types';

console.log('xtracter content script loaded');

const OBSERVER_CONFIG = { childList: true, subtree: true };
const PROCESSED_IMAGE_CLASS = 'xtracter-image-processed';
const PROCESSED_VIDEO_CLASS = 'xtracter-video-processed';

function createButtonContainer(metadata: TweetMetadata, type: 'IMAGE' | 'VIDEO' = 'IMAGE'): HTMLDivElement {
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.top = '5px';
    container.style.right = '5px';
    container.style.zIndex = '9999';
    container.style.display = 'flex';
    container.style.gap = '5px';

    // Stop propagation on container to prevent clicking image/post
    container.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
    });

    const dlBtn = createButton(type === 'VIDEO' ? 'DL VIDEO' : 'DL', '#000', () => handleAction(metadata, 'DOWNLOAD', type));
    const postBtn = createButton('POST', '#0056b3', () => handleAction(metadata, 'POST_DOWNLOAD', type));

    container.appendChild(dlBtn);
    container.appendChild(postBtn);
    return container;
}

function createButton(text: string, bgColor: string, onClick: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.innerText = text;
    button.style.backgroundColor = bgColor;
    button.style.color = 'white';
    button.style.border = 'none';
    button.style.borderRadius = '4px';
    button.style.padding = '4px 8px';
    button.style.cursor = 'pointer';
    button.style.fontWeight = 'bold';
    button.style.fontSize = '12px';
    button.style.opacity = '0.8';
    button.style.transition = 'opacity 0.2s';

    button.addEventListener('mouseover', () => {
        button.style.opacity = '1';
    });
    button.addEventListener('mouseout', () => {
        button.style.opacity = '0.8';
    });

    button.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
    });

    return button;
}


function handleAction(metadata: TweetMetadata, type: 'DOWNLOAD' | 'POST_DOWNLOAD', mediaType: 'IMAGE' | 'VIDEO') {
    console.log(`Action ${type} triggered:`, metadata);

    // For videos, we rely on server-side yt-dlp which needs cookies for best results,
    // though for public tweets it might work without.
    // The previous implementation fetched cookies for videos. We'll keep that.
    const tweetUrl = metadata.sourceUrls && metadata.sourceUrls.length > 0 ? metadata.sourceUrls[0] : metadata.targetUrl;

    if (mediaType === 'VIDEO') {
        chrome.runtime.sendMessage({ type: 'GET_COOKIES', url: tweetUrl }, (cookies) => {
            if (cookies) {
                metadata.cookies = cookies;
            }
            chrome.runtime.sendMessage({ type, data: metadata });
        });
    } else {
        chrome.runtime.sendMessage({ type, data: metadata });
    }
}


function findTweetArticle(element: HTMLElement): HTMLElement | null {
    // 1. Standard case: ancestor
    const closest = element.closest('article');
    if (closest) return closest;

    // 2. Popup/Layer case: search in common layer
    const layer = element.closest('[data-testid="layers"]') || document.querySelector('[data-testid="layers"]');
    if (layer) {
        const article = layer.querySelector('article');
        if (article) return article as HTMLElement;
    }

    // 3. Document-wide search (focusing on the single active article if unique)
    const articles = document.querySelectorAll('article');
    if (articles.length === 1) return articles[0] as HTMLElement;

    return null;
}

function extractMetadataFromUrl(): { authorId: string, tweetUrl: string } {
    const url = new URL(window.location.href);
    const pathParts = url.pathname.split('/').filter(p => p);

    let authorId = '';
    let tweetUrl = window.location.href;

    // pathParts check: ['username', 'status', '1234567890', 'photo', '1']
    if (pathParts.length >= 3 && pathParts[1] === 'status') {
        authorId = '@' + pathParts[0];
        // Remove /photo/1, /video/1 to reconstruct base Tweet URL
        tweetUrl = `${url.origin}/${pathParts[0]}/status/${pathParts[2]}`;
    }

    return { authorId, tweetUrl };
}

function extractMetadata(article: HTMLElement | null, element: HTMLElement, mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE'): TweetMetadata {
    let tweetText = '';
    let timestamp = '';
    let tweetUrl = window.location.href;
    let authorName = '';
    let authorId = '';

    // If article is found, try to extract from DOM
    if (article) {
        const tweetTextNode = article.querySelector('div[data-testid="tweetText"]');
        tweetText = tweetTextNode ? (tweetTextNode as HTMLElement).innerText : '';

        const timeNode = article.querySelector('time');
        timestamp = timeNode ? timeNode.getAttribute('datetime') || '' : '';

        const timeLink = timeNode?.closest('a');
        if (timeLink) tweetUrl = timeLink.href;

        const userNameNode = article.querySelector('div[data-testid="User-Name"]');
        authorName = (userNameNode?.querySelector('span')?.innerText) || '';

        const userAnchor = userNameNode?.querySelector('a');
        if (userAnchor) {
            try {
                const url = new URL(userAnchor.href);
                const pathParts = url.pathname.split('/').filter(p => p);
                if (pathParts.length > 0) {
                    authorId = '@' + pathParts[0];
                }
            } catch (e) {
                console.error('Error parsing user URL:', e);
            }
        }

        if (!authorId) {
            authorId = ((userNameNode as HTMLElement)?.innerText?.match(/@\w+/)?.[0]) || '';
        }
    }

    // Fallback: extract from URL if critical info is missing
    if (!authorId || !tweetUrl || tweetUrl === window.location.href) {
        const urlMetadata = extractMetadataFromUrl();
        if (urlMetadata.authorId && !authorId) authorId = urlMetadata.authorId;
        if (urlMetadata.tweetUrl) tweetUrl = urlMetadata.tweetUrl;
    }

    let targetUrl: string;

    if (mediaType === 'VIDEO') {
        // For video, targetUrl is the tweet URL (processed by yt-dlp on server)
        targetUrl = tweetUrl;
    } else {
        // For image, targetUrl is the direct image URL
        try {
            const img = element as HTMLImageElement;
            const url = new URL(img.src);
            url.searchParams.set('name', 'orig');
            targetUrl = url.toString();
        } catch (e) {
            console.error('Failed to parse image URL:', (element as HTMLImageElement).src, e);
            targetUrl = (element as HTMLImageElement).src;
        }
    }

    const authors: Author[] = [];
    if (authorName || authorId) {
        authors.push({
            name: authorName || authorId, // fallback name to ID if name missing
            accountId: authorId
        });
    }

    const sourceUrls = [tweetUrl];
    if (mediaType === 'IMAGE') {
        sourceUrls.unshift(targetUrl);
    }

    return {
        targetUrl,
        sourceUrls,
        description: tweetText,
        createdAt: timestamp,
        authors,
        userAgent: navigator.userAgent
    };
}

const processedMetadata = new Map<string, TweetMetadata>();

// Listen for requests from Popup/Background
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'GET_METADATA') {
        const allMetadata = Array.from(processedMetadata.values());
        console.log('Sending metadata to popup:', allMetadata.length, 'items');
        sendResponse(allMetadata);
    }
});

function processMedia() {
    // Process Images
    const images = document.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    images.forEach((img) => {
        const imageElement = img as HTMLImageElement;

        if (imageElement.parentElement?.classList.contains(PROCESSED_IMAGE_CLASS)) return;

        const container = imageElement.parentElement;
        if (container) {
            // Extract metadata first
            const tweetArticle = findTweetArticle(imageElement);
            const metadata = extractMetadata(tweetArticle, imageElement, 'IMAGE');

            // Store metadata for bulk export
            if (metadata.targetUrl && !processedMetadata.has(metadata.targetUrl)) {
                processedMetadata.set(metadata.targetUrl, metadata);
            }

            const style = window.getComputedStyle(container);
            if (style.position === 'static') {
                container.style.position = 'relative';
            }
            container.classList.add(PROCESSED_IMAGE_CLASS);
            const btnContainer = createButtonContainer(metadata, 'IMAGE');
            container.appendChild(btnContainer);
        }
    });

    // Process Videos/GIFs
    const videoComponents = document.querySelectorAll('div[data-testid="videoComponent"]');
    videoComponents.forEach((videoComponent) => {
        const container = videoComponent.parentElement;
        if (!container || container.classList.contains(PROCESSED_VIDEO_CLASS)) return;
        if (container.querySelector(`.${PROCESSED_VIDEO_CLASS}`)) return;

        const tweetArticle = findTweetArticle(videoComponent as HTMLElement);
        const metadata = extractMetadata(tweetArticle, container as HTMLElement, 'VIDEO');

        // Store metadata for bulk export
        if (metadata.targetUrl && !processedMetadata.has(metadata.targetUrl)) {
            processedMetadata.set(metadata.targetUrl, metadata);
        }

        const style = window.getComputedStyle(container);
        if (style.position === 'static') {
            container.style.position = 'relative';
        }

        container.classList.add(PROCESSED_VIDEO_CLASS);

        const btnContainer = createButtonContainer(metadata, 'VIDEO');
        btnContainer.style.top = '10px';
        btnContainer.style.right = '10px';

        container.appendChild(btnContainer);
    });
}

const observer = new MutationObserver((mutations) => {
    let shouldProcess = false;
    for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
            shouldProcess = true;
            break;
        }
    }
    if (shouldProcess) {
        processMedia();
    }
});

observer.observe(document.body, OBSERVER_CONFIG);

processMedia();
