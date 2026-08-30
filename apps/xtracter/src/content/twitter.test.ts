import { describe, expect, it } from "vitest";
import {
	extractFromArticle,
	extractTwitterAuthorIdFromStatusUrl,
	isTwitterStatusUrl,
} from "./twitter";

describe("extractTwitterAuthorIdFromStatusUrl", () => {
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
});
