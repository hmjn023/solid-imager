import type { Author, TweetMetadata } from "@ext/schema";

const PROCESSED_IMAGE_CLASS = "xtracter-image-processed";

const TWITTER_REGEX =
  /^https?:\/\/(?:(?:[a-z0-9-]+\.)?(?:twitter\.com|x\.com|vxtwitter\.com|fxtwitter\.com))\/(?:@)?([a-zA-Z0-9_]+)/i;

function extractSourceUrls(baseUrls: string[]): {
  sourceUrls: string[];
  twitterAccountId: string | null;
} {
  const sourceUrls = [...baseUrls];
  let twitterAccountId: string | null = null;
  const sourceLinks = document.querySelectorAll<HTMLAnchorElement>(
    "#post-info-source a"
  );
  for (const link of sourceLinks) {
    const href = link.href;
    if (href && !sourceUrls.includes(href)) {
      sourceUrls.push(href);

      const twitterMatch = href.match(TWITTER_REGEX);
      if (
        twitterMatch?.[1] &&
        ![
          "intent",
          "search",
          "share",
          "home",
          "i",
          "messages",
          "notifications",
          "settings",
        ].includes(twitterMatch[1].toLowerCase())
      ) {
        twitterAccountId = `@${twitterMatch[1]}`;
      }
    }
  }
  return { sourceUrls, twitterAccountId };
}

export function processDanbooruMedia(
  createButtonContainer: (
    metadata: TweetMetadata,
    type: "IMAGE" | "VIDEO"
  ) => HTMLDivElement
) {
  // Danbooru has one main image per post page usually `#image` or `.image-container`
  const imageContainer = document.querySelector(
    ".image-container"
  ) as HTMLElement;
  if (
    !imageContainer ||
    imageContainer.classList.contains(PROCESSED_IMAGE_CLASS)
  ) {
    return;
  }

  const metadata = extractDanbooruMetadata(imageContainer);
  if (!metadata) {
    return;
  }

  const style = window.getComputedStyle(imageContainer);
  if (style.position === "static") {
    imageContainer.style.position = "relative";
  }
  imageContainer.classList.add(PROCESSED_IMAGE_CLASS);

  const btnContainer = createButtonContainer(metadata, "IMAGE");
  imageContainer.appendChild(btnContainer);
}

function extractTargetUrl(container: HTMLElement): string | null {
  const imgElement = container.querySelector("#image") as HTMLImageElement;
  let targetUrl = "";

  if (imgElement?.src) {
    targetUrl = imgElement.src;
  }
  if (!targetUrl) {
    // Fallback if image tag is not found or has no src
    const fileUrl = container.getAttribute("data-file-url");
    if (fileUrl) {
      targetUrl = fileUrl.startsWith("/")
        ? `${window.location.origin}${fileUrl}`
        : fileUrl;
    }
  }

  return targetUrl || null;
}

function extractDanbooruMetadata(container: HTMLElement): TweetMetadata | null {
  const targetUrl = extractTargetUrl(container);
  if (!targetUrl) {
    return null;
  }

  const baseUrls = [targetUrl, window.location.href];
  const { sourceUrls, twitterAccountId } = extractSourceUrls(baseUrls);

  const authors: Author[] = [];
  const tags: { name: string; type: "positive"; source: "danbooru" }[] = [];
  const characters: { name: string; source: "danbooru" }[] = [];
  const ips: { name: string; source: "danbooru" }[] = [];

  extractTags(authors, ips, characters, tags);

  if (twitterAccountId) {
    for (const author of authors) {
      if (!author.accountId) {
        author.accountId = twitterAccountId;
      }
    }
  }

  // Find post time
  const timeNode = document.querySelector("time");
  const timestamp = timeNode ? timeNode.getAttribute("datetime") || "" : "";

  return {
    targetUrl,
    sourceUrls,
    description: document.title, // or empty, Danbooru usually doesn't have a post body description
    createdAt: timestamp,
    authors,
    tags,
    characters,
    ips,
    userAgent: navigator.userAgent,
  };
}

function extractTags(
  authors: Author[],
  ips: { name: string; source: "danbooru" }[],
  characters: { name: string; source: "danbooru" }[],
  tags: { name: string; type: "positive"; source: "danbooru" }[]
) {
  // Artists: .tag-type-1
  for (const node of document.querySelectorAll(".tag-type-1 .search-tag")) {
    if (node.textContent) {
      authors.push({ name: node.textContent, accountId: null });
    }
  }

  // Copyrights: .tag-type-3
  for (const node of document.querySelectorAll(".tag-type-3 .search-tag")) {
    if (node.textContent) {
      ips.push({ name: node.textContent, source: "danbooru" });
    }
  }

  // Characters: .tag-type-4
  for (const node of document.querySelectorAll(".tag-type-4 .search-tag")) {
    if (node.textContent) {
      characters.push({ name: node.textContent, source: "danbooru" });
    }
  }

  // General/Meta: .tag-type-0, .tag-type-5
  for (const node of document.querySelectorAll(
    ".tag-type-0 .search-tag, .tag-type-5 .search-tag"
  )) {
    if (node.textContent) {
      tags.push({
        name: node.textContent,
        type: "positive",
        source: "danbooru",
      });
    }
  }
}
