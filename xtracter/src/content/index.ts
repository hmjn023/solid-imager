import type { TweetMetadata } from "@ext/schema";
import { processDanbooruMedia } from "./danbooru";
import { processTwitterMedia } from "./twitter";

const OBSERVER_CONFIG = { childList: true, subtree: true };

function createButtonContainer(
  metadata: TweetMetadata,
  type: "IMAGE" | "VIDEO" = "IMAGE"
): HTMLDivElement {
  const container = document.createElement("div");
  container.style.position = "absolute";
  container.style.top = "5px";
  container.style.right = "5px";
  container.style.zIndex = "9999";
  container.style.display = "flex";
  container.style.gap = "5px";

  // Stop propagation on container to prevent clicking image/post
  container.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  const dlBtn = createButton(type === "VIDEO" ? "DL VIDEO" : "DL", "#000", () =>
    handleAction(metadata, "DOWNLOAD", type)
  );
  const postBtn = createButton("POST", "#0056b3", () =>
    handleAction(metadata, "POST_DOWNLOAD", type)
  );

  container.appendChild(dlBtn);
  container.appendChild(postBtn);
  return container;
}

function createButton(
  text: string,
  bgColor: string,
  onClick: () => void
): HTMLButtonElement {
  const button = document.createElement("button");
  button.innerText = text;
  button.style.backgroundColor = bgColor;
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.padding = "4px 8px";
  button.style.cursor = "pointer";
  button.style.fontWeight = "bold";
  button.style.fontSize = "12px";
  button.style.opacity = "0.8";
  button.style.transition = "opacity 0.2s";

  button.addEventListener("mouseover", () => {
    button.style.opacity = "1";
  });
  button.addEventListener("mouseout", () => {
    button.style.opacity = "0.8";
  });

  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    onClick();
  });

  return button;
}

function handleAction(
  metadata: TweetMetadata,
  type: "DOWNLOAD" | "POST_DOWNLOAD",
  mediaType: "IMAGE" | "VIDEO"
) {
  const tweetUrl =
    metadata.sourceUrls && metadata.sourceUrls.length > 0
      ? metadata.sourceUrls[0]
      : metadata.targetUrl;

  if (mediaType === "VIDEO") {
    chrome.runtime.sendMessage(
      { type: "GET_COOKIES", url: tweetUrl },
      (cookies) => {
        if (cookies) {
          metadata.cookies = cookies;
        }
        chrome.runtime.sendMessage({ type, data: metadata });
      }
    );
  } else {
    chrome.runtime.sendMessage({ type, data: metadata });
  }
}

const processedMetadata = new Map<string, TweetMetadata>();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "GET_METADATA") {
    const allMetadata = Array.from(processedMetadata.values());
    sendResponse(allMetadata);
  }
});

function processMedia() {
  const hostname = window.location.hostname;
  if (hostname.includes("twitter.com") || hostname.includes("x.com")) {
    processTwitterMedia(processedMetadata, createButtonContainer);
  } else if (hostname.includes("danbooru.donmai.us")) {
    processDanbooruMedia(createButtonContainer);
  }
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
