import { expect, it, vi } from "vitest";
import { tagsRouter } from "~/infrastructure/api/routers/tags-router";

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
});
