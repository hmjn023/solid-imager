// ... existing imports ...
import { TweetMetadata } from '../types';

console.log('xtracter content script loaded');

const OBSERVER_CONFIG = { childList: true, subtree: true };
const PROCESSED_IMAGE_CLASS = 'xtracter-image-processed';
const PROCESSED_VIDEO_CLASS = 'xtracter-video-processed';

function createButtonContainer(element: HTMLElement, type: 'IMAGE' | 'VIDEO' = 'IMAGE'): HTMLDivElement {
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

    const dlBtn = createButton(type === 'VIDEO' ? 'DL VIDEO' : 'DL', '#000', () => handleAction(element, 'DOWNLOAD', type));
    const postBtn = createButton('POST', '#0056b3', () => handleAction(element, 'POST_DOWNLOAD', type));

    container.appendChild(dlBtn);
    container.appendChild(postBtn);
    return container;
}

function createButton(text: string, bgColor: string, onClick: () => void): HTMLButtonElement {
    // ... existing createButton implementation ...
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

function handleAction(element: HTMLElement, type: 'DOWNLOAD' | 'POST_DOWNLOAD', mediaType: 'IMAGE' | 'VIDEO') {
    const tweetArticle = element.closest('article');
    if (!tweetArticle) {
        console.error('Could not find tweet article');
        return;
    }

    const metadata = extractMetadata(tweetArticle, element as HTMLImageElement, mediaType); // cast if image, but for video we might pass container or poster
    console.log(`Action ${type} triggered:`, metadata);

    if (mediaType === 'VIDEO') {
        // Fetch cookies for video downloads to handle auth
        chrome.runtime.sendMessage({ type: 'GET_COOKIES', url: metadata.tweetUrl }, (cookies) => {
            if (cookies) {
                metadata.cookies = cookies;
            }
            chrome.runtime.sendMessage({ type, data: metadata });
        });
    } else {
        chrome.runtime.sendMessage({ type, data: metadata });
    }
}

function extractMetadata(article: HTMLElement, element: HTMLElement, mediaType: 'IMAGE' | 'VIDEO' = 'IMAGE'): TweetMetadata {
    const tweetTextNode = article.querySelector('div[data-testid="tweetText"]');
    const tweetText = tweetTextNode ? (tweetTextNode as HTMLElement).innerText : '';

    const timeNode = article.querySelector('time');
    const timestamp = timeNode ? timeNode.getAttribute('datetime') || '' : '';

    const timeLink = timeNode?.closest('a');
    const tweetUrl = timeLink ? timeLink.href : window.location.href;

    const userNameNode = article.querySelector('div[data-testid="User-Name"]');
    const authorName = (userNameNode?.querySelector('span')?.innerText) || '';

    let authorId = '';
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
        authorId = ((userNameNode as HTMLElement)?.innerText.match(/@\w+/)?.[0]) || '';
    }

    let imageUrl: string;

    if (mediaType === 'VIDEO') {
        // For video, we use the tweet URL as the image URL
        // backend should handle this if it detects a tweet URL
        imageUrl = tweetUrl;
    } else {
        // Image logic
        try {
            const img = element as HTMLImageElement;
            const url = new URL(img.src);
            url.searchParams.set('name', 'orig');
            imageUrl = url.toString();
        } catch (e) {
            console.error('Failed to parse image URL:', (element as HTMLImageElement).src, e);
            imageUrl = (element as HTMLImageElement).src;
        }
    }

    return {
        imageUrl, // repurposed for tweetUrl in case of video
        tweetUrl,
        tweetText,
        timestamp,
        authorName,
        authorId,
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

function processImages() {
    // Process Images
    const images = document.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    images.forEach((img) => {
        const imageElement = img as HTMLImageElement;

        // Store metadata for bulk export
        const tweetArticle = imageElement.closest('article');
        if (tweetArticle) {
            const metadata = extractMetadata(tweetArticle as HTMLElement, imageElement, 'IMAGE');
            if (metadata.imageUrl && !processedMetadata.has(metadata.imageUrl)) {
                processedMetadata.set(metadata.imageUrl, metadata);
            }
        }

        if (imageElement.parentElement?.classList.contains(PROCESSED_IMAGE_CLASS)) return;

        const container = imageElement.parentElement;
        if (container) {
            const style = window.getComputedStyle(container);
            if (style.position === 'static') {
                container.style.position = 'relative';
            }
            container.classList.add(PROCESSED_IMAGE_CLASS);
            const btnContainer = createButtonContainer(imageElement, 'IMAGE');
            container.appendChild(btnContainer);
        }
    });

    // Process Videos/GIFs
    // Twitter videos are usually in div[data-testid="videoComponent"] or have a specific structure.
    // They often have a poster image or video element.
    const videoComponents = document.querySelectorAll('div[data-testid="videoComponent"]');
    videoComponents.forEach((videoComponent) => {
        // Find a suitable container to attach the button to.
        // Usually the videoComponent itself or a child wrapper.
        // We need to make sure we don't break the player UI.
        const container = videoComponent.parentElement;
        if (!container || container.classList.contains(PROCESSED_VIDEO_CLASS)) return;

        // Check if there is already a processed marker inside (to avoid double processing if we query differently)
        if (container.querySelector(`.${PROCESSED_VIDEO_CLASS}`)) return;

        const style = window.getComputedStyle(container);
        if (style.position === 'static') {
            container.style.position = 'relative';
        }

        container.classList.add(PROCESSED_VIDEO_CLASS);

        // Pass the container or one of its children as the 'element' reference? 
        // We just need it to find the article in handleAction.
        const btnContainer = createButtonContainer(container as HTMLElement, 'VIDEO');

        // Adjust position for video?
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
        processImages();
    }
});

observer.observe(document.body, OBSERVER_CONFIG);

processImages();