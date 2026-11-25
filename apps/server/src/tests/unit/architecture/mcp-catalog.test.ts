import { expect, it, vi } from "vitest";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";
import { mediaToolsRouter } from "~/infrastructure/api/routers/media-tools-router";

vi.mock("~/infrastructure/api/app-router", () => {
	throw new Error(
		"Building the tool catalog must not load the assembled app router",
	);
});

it("builds the catalog from feature procedures without loading the settings router through appRouter", async () => {
	const { toolCatalog } = await import("~/infrastructure/mcp/catalog");

	expect(toolCatalog.get("tags_list")?.procedure).toBe(tagsRouter.list);
	expect(
		[...toolCatalog.values()].some(({ info }) => info.group === "config"),
	).toBe(false);
	expect(toolCatalog.has("viewer_loginPixiv")).toBe(false);
	expect(toolCatalog.has("viewer_setPixivBookmark")).toBe(false);
	expect(toolCatalog.has("media_getContent")).toBe(false);
});

it("uses the compact ranked search procedures under the existing publishable tool names", async () => {
	const { toolCatalog } = await import("~/infrastructure/mcp/catalog");

	expect(toolCatalog.get("media_searchSimilar")?.procedure).toBe(
		mediaToolsRouter.search_similar_media,
	);
	expect(toolCatalog.get("media_searchSemantic")?.procedure).toBe(
		mediaToolsRouter.search_semantic_media,
	);
	expect(toolCatalog.has("search_similar_media")).toBe(false);
	expect(toolCatalog.has("search_semantic_media")).toBe(false);
});
