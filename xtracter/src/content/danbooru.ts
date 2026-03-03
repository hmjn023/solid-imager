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

  // Check provided baseUrls for Twitter IDs first
  for (const url of baseUrls) {
    const match = url.match(TWITTER_REGEX);
    if (match?.[1] && !isExcludedTwitterUser(match[1])) {
      twitterAccountId = `@${match[1]}`;
      break;
    }
  }

  // Then add DOM sources if we are on a post page
  const sourceLinks = document.querySelectorAll<HTMLAnchorElement>(
    "#post-info-source a"
  );
  for (const link of sourceLinks) {
    const href = link.href;
    if (href && !sourceUrls.includes(href)) {
      sourceUrls.push(href);

      if (!twitterAccountId) {
        const twitterMatch = href.match(TWITTER_REGEX);
        if (twitterMatch?.[1] && !isExcludedTwitterUser(twitterMatch[1])) {
          twitterAccountId = `@${twitterMatch[1]}`;
        }
      }
    }
  }
  return { sourceUrls, twitterAccountId };
}

function isExcludedTwitterUser(username: string): boolean {
  const excluded = [
    "intent",
    "search",
    "share",
    "home",
    "i",
    "messages",
    "notifications",
    "settings",
  ];
  return excluded.includes(username.toLowerCase());
}

export function processDanbooruMedia(
  createButtonContainer: (
    metadata: TweetMetadata,
    type: "IMAGE" | "VIDEO"
  ) => HTMLDivElement,
  createAsyncButtonContainer: (
    fetchMetadata: () => Promise<TweetMetadata | null>,
    type: "IMAGE" | "VIDEO"
  ) => HTMLDivElement
) {
  // Danbooru has one main image per post page usually `#image` or `.image-container`
  const imageContainer = document.querySelector(
    ".image-container"
  ) as HTMLElement;

  // Post page logic
  if (
    imageContainer &&
    !imageContainer.classList.contains(PROCESSED_IMAGE_CLASS)
  ) {
    const metadata = extractDanbooruMetadata(imageContainer);
    if (metadata) {
      const style = window.getComputedStyle(imageContainer);
      if (style.position === "static") {
        imageContainer.style.position = "relative";
      }
      imageContainer.classList.add(PROCESSED_IMAGE_CLASS);

      const btnContainer = createButtonContainer(metadata, "IMAGE");
      imageContainer.appendChild(btnContainer);
    }
  }

  // List page logic
  const postPreviews = document.querySelectorAll(
    `.post-preview:not(.${PROCESSED_IMAGE_CLASS})`
  );
  for (const preview of postPreviews) {
    const postId = preview.getAttribute("data-id");
    if (!postId) {
      continue;
    }

    const previewContainer = preview.querySelector(
      ".post-preview-container"
    ) as HTMLElement;
    if (!previewContainer) {
      continue;
    }

    preview.classList.add(PROCESSED_IMAGE_CLASS);
    const style = window.getComputedStyle(previewContainer);
    if (style.position === "static") {
      previewContainer.style.position = "relative";
    }

    const fetchMetadata = async () => {
      try {
        const response = await fetch(
          `https://danbooru.donmai.us/posts/${postId}.json`
        );
        if (!response.ok) {
          return null;
        }
        const data = await response.json();
        return parseDanbooruApiMetadata(data, postId);
      } catch {
        return null;
      }
    };

    const btnContainer = createAsyncButtonContainer(fetchMetadata, "IMAGE");
    previewContainer.appendChild(btnContainer);
  }
}

// Define a minimal interface for the expected API response
type DanbooruApiResponse = {
  file_url?: string;
  source?: string;
  tag_string_artist?: string;
  tag_string_copyright?: string;
  tag_string_character?: string;
  tag_string_general?: string;
  tag_string_meta?: string;
  created_at?: string;
};

function parseTagsFromApiString(tagString: string | undefined): string[] {
  if (!tagString) {
    return [];
  }
  const result: string[] = [];
  for (const name of tagString.split(" ")) {
    if (!name) {
      continue;
    }
    result.push(name);
  }
  return result;
}

function parseDanbooruApiMetadata(
  data: DanbooruApiResponse,
  postId: string
): TweetMetadata | null {
  const targetUrl = data.file_url;
  if (!targetUrl) {
    return null;
  }

  const postUrl = `https://danbooru.donmai.us/posts/${postId}`;
  const sourceUrls = [postUrl, targetUrl];
  if (data.source) {
    sourceUrls.push(data.source);
  }

  const { twitterAccountId } = extractSourceUrls(sourceUrls);

  const authors: Author[] = [];
  const tags: { name: string; type: "positive"; source: "danbooru" }[] = [];
  const characters: { name: string; source: "danbooru" }[] = [];
  const ips: { name: string; source: "danbooru" }[] = [];

  // Parse artists
  for (const name of parseTagsFromApiString(data.tag_string_artist)) {
    authors.push({ name, accountId: twitterAccountId });
  }

  // Parse copyrights (IPs)
  for (const name of parseTagsFromApiString(data.tag_string_copyright)) {
    ips.push({ name, source: "danbooru" });
  }

  // Parse characters
  for (const name of parseTagsFromApiString(data.tag_string_character)) {
    characters.push({ name, source: "danbooru" });
  }

  // Parse general tags
  for (const name of parseTagsFromApiString(data.tag_string_general)) {
    tags.push({ name, type: "positive", source: "danbooru" });
  }

  for (const name of parseTagsFromApiString(data.tag_string_meta)) {
    tags.push({ name, type: "positive", source: "danbooru" });
  }

  return {
    targetUrl,
    sourceUrls,
    description: `Danbooru Post #${postId}`,
    createdAt: data.created_at,
    authors,
    tags,
    characters,
    ips,
    userAgent: navigator.userAgent,
  };
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
