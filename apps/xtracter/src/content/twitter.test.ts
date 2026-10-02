import { afterEach, describe, expect, it, vi } from "vitest";
import {
	extractFromArticle,
	extractMetadata,
	extractTwitterAuthorIdFromStatusUrl,
	isTwitterStatusUrl,
} from "./twitter";

describe("extractTwitterAuthorIdFromStatusUrl", () => {
	afterEach(() => vi.unstubAllGlobals());
	it("extracts the handle from an X status permalink", () => {
		expect(
			extractTwitterAuthorIdFromStatusUrl(
				"https://x.com/Creator_123/status/1234567890",
			),
		).toBe("@Creator_123");
	});

	it("extracts the handle from a legacy Twitter status permalink", () => {
		expect(
			extractTwitterAuthorIdFromStatusUrl(
				"https://twitter.com/creator/status/1234567890?s=20",
			),
		).toBe("@creator");
	});

	it.each([
		"https://x.com/i/status/1234567890",
		"https://x.com/i/web/status/1234567890",
	])("recognizes handle-less status URL %s", (url) => {
		expect(isTwitterStatusUrl(url)).toBe(true);
		expect(extractTwitterAuthorIdFromStatusUrl(url)).toBe("");
	});

	it("does not interpret display-name mentions as account IDs", () => {
		expect(
			extractTwitterAuthorIdFromStatusUrl(
				"https://x.com/not-a-status/display-name-@C107",
			),
		).toBe("");
	});

	it("does not use unrelated status links without a current-post permalink", () => {
		const quotedPostUrl = "https://x.com/quoted/status/9876543210";
		const timeLink = { href: "https://x.com/creator" };
		const timeNode = {
			getAttribute: () => "2026-08-30T00:00:00.000Z",
			closest: () => timeLink,
		};
		const userNameNode = {
			querySelector: () => ({ innerText: "Creator" }),
		};
		const article = {
			querySelector: (selector: string) => {
				if (selector === "time") return timeNode;
				if (selector === 'div[data-testid="tweetText"]') return null;
				if (selector === 'div[data-testid="User-Name"]') {
					return userNameNode;
				}
				return null;
			},
			querySelectorAll: () => [
				{ href: quotedPostUrl },
				{ href: "https://x.com/creator/status/1234567890" },
			],
		} as unknown as HTMLElement;

		expect(extractFromArticle(article)).toMatchObject({
			tweetUrl: "",
			authorId: "",
		});
	});
	it.each([1, 2])(
		"preserves the post permalink and metadata for photo %i of the same post",
		(photo) => {
			const postUrl = "https://x.com/creator/status/100";
			const photoUrl = `${postUrl}/photo/${photo}`;
			class FixtureImage {
				src = "https://pbs.twimg.com/media/original.jpg";
				closest() {
					return { href: photoUrl };
				}
			}
			vi.stubGlobal("HTMLImageElement", FixtureImage);
			vi.stubGlobal("navigator", { userAgent: "fixture" });
			const article = {
				querySelector: (selector: string) => {
					if (selector === "time")
						return {
							getAttribute: () => "2026-01-01T00:00:00.000Z",
							closest: () => ({ href: postUrl }),
						};
					if (selector.includes("User-Name"))
						return { querySelector: () => ({ innerText: "Creator" }) };
					return { innerText: "Original text" };
				},
			} as unknown as HTMLElement;
			const item = extractMetadata(
				article,
				new FixtureImage() as unknown as HTMLElement,
			);
			expect(item.sourceUrls).toContain(postUrl);
			expect(item.sourceUrls).not.toContain(photoUrl);
			expect(item.authors).toEqual([
				expect.objectContaining({ name: "Creator", accountId: "@creator" }),
			]);
			expect(item.description).toBe("Original text");
			expect(item.createdAt).toBe("2026-01-01T00:00:00.000Z");
		},
	);
	it("associates a quoted image with the image permalink instead of the outer article's author", () => {
		const quotedUrl = "https://x.com/quoted/status/200/photo/1";
		class FixtureImage {
			src = "https://pbs.twimg.com/media/quoted.jpg";
			closest() {
				return { href: quotedUrl };
			}
		}
		vi.stubGlobal("HTMLImageElement", FixtureImage);
		vi.stubGlobal("navigator", { userAgent: "fixture" });
		const article = {
			querySelector: (selector: string) => {
				if (selector === "time")
					return {
						getAttribute: () => "2026-01-01",
						closest: () => ({ href: "https://x.com/outer/status/100" }),
					};
				if (selector.includes("User-Name"))
					return { querySelector: () => ({ innerText: "Outer Author" }) };
				return { innerText: "Outer comment" };
			},
		} as unknown as HTMLElement;
		const item = extractMetadata(
			article,
			new FixtureImage() as unknown as HTMLElement,
		);
		expect(item.authors).toEqual([
			expect.objectContaining({
				name: "@quoted",
				accountId: "@quoted",
				platform: "twitter",
			}),
		]);
		expect(item.sourceUrls).toContain(quotedUrl);
		expect(item.sourceUrls).not.toContain("https://x.com/outer/status/100");
		expect(item.description).toBe("");
	});
});
