import { TweetMetadata } from '../types';

console.log('xtracter content script loaded');

const OBSERVER_CONFIG = { childList: true, subtree: true };
const PROCESSED_CLASS = 'xtracter-processed';

function createButtonContainer(img: HTMLImageElement): HTMLDivElement {
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

    const dlBtn = createButton('DL', '#000', () => handleAction(img, 'DOWNLOAD'));
    const postBtn = createButton('POST', '#0056b3', () => handleAction(img, 'POST_DOWNLOAD'));

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

function handleAction(img: HTMLImageElement, type: 'DOWNLOAD' | 'POST_DOWNLOAD') {
    const tweetArticle = img.closest('article');
    if (!tweetArticle) {
        console.error('Could not find tweet article');
        return;
    }

    const metadata = extractMetadata(tweetArticle, img);
    console.log(`Action ${type} triggered:`, metadata);

    chrome.runtime.sendMessage({ type, data: metadata });
}

function extractMetadata(article: HTMLElement, img: HTMLImageElement): TweetMetadata {
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
    try {
        const url = new URL(img.src);
        url.searchParams.set('name', 'orig');
        imageUrl = url.toString();
    } catch (e) {
        console.error('Failed to parse image URL:', img.src, e);
        imageUrl = img.src;
    }

    return {
        imageUrl,
        tweetUrl,
        tweetText,
        timestamp,
        authorName,
        authorId
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
    const images = document.querySelectorAll('img[src*="pbs.twimg.com/media"]');
    images.forEach((img) => {
        const imageElement = img as HTMLImageElement;

        // Store metadata for bulk export
        const tweetArticle = imageElement.closest('article');
        if (tweetArticle) {
            const metadata = extractMetadata(tweetArticle as HTMLElement, imageElement);
            if (metadata.imageUrl && !processedMetadata.has(metadata.imageUrl)) {
                processedMetadata.set(metadata.imageUrl, metadata);
            }
        }

        if (imageElement.parentElement?.classList.contains(PROCESSED_CLASS)) return;

        const container = imageElement.parentElement;
        if (container) {
            const style = window.getComputedStyle(container);
            if (style.position === 'static') {
                container.style.position = 'relative';
            }
            container.classList.add(PROCESSED_CLASS);
            const btnContainer = createButtonContainer(imageElement);
            container.appendChild(btnContainer);
        }
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