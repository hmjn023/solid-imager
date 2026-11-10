import { QueryClient } from "@tanstack/solid-query";
import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "../toast";
import { useSourcesPage, type SourcesPageActions } from "./use-sources-page";

vi.mock("solid-js", async () =>
	vi.importActual<typeof import("solid-js")>("solid-js/dist/solid.js"),
);
vi.mock("../toast", () => ({
	toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));
const disposers: Array<() => void> = [];
beforeEach(() => vi.clearAllMocks());
afterEach(() => disposers.splice(0).forEach((dispose) => dispose()));
const source = (id: string) => ({
	id,
	name: id,
	type: "local" as const,
	description: null,
	connectionInfo: { path: "/source" },
	createdAt: new Date(),
	updatedAt: new Date(),
});
function setup() {
	return createRoot((dispose) => {
		disposers.push(dispose);
		const actions: SourcesPageActions = {
			createMediaSource: vi.fn(),
			updateMediaSource: vi.fn(),
			deleteMediaSource: vi.fn(),
			syncMediaSources: vi.fn<SourcesPageActions["syncMediaSources"]>(),
		};
		const queryClient = new QueryClient();
		const invalidate = vi.spyOn(queryClient, "invalidateQueries");
		return {
			actions,
			invalidate,
			page: useSourcesPage({
				actions,
				queryClient,
				invalidateQueryKey: ["sources"],
			}),
		};
	});
}
const successful = (id: string) => ({
	id,
	sourceId: id,
	success: true as const,
	added: 2,
	deleted: 0,
	failed: 0,
});
const failed = (id: string) => ({
	id,
	sourceId: id,
	success: false as const,
	added: 1,
	deleted: 0,
	failed: 1,
	error: "Source path is not accessible",
});

describe("source synchronization feedback", () => {
	it("reports a fulfilled RPC's failed result instead of showing success", async () => {
		const { actions, page, invalidate } = setup();
		vi.mocked(actions.syncMediaSources).mockResolvedValueOnce({
			results: [failed("one")],
		});
		await page.handleSyncSource(source("one"));
		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledExactlyOnceWith(
			"Failed to sync one: Source path is not accessible",
		);
		expect(invalidate).toHaveBeenCalledOnce();
		expect(page.isSyncing()).toBe(false);
	});

	it("reports how many sources failed after a partially successful batch", async () => {
		const { actions, page } = setup();
		vi.mocked(actions.syncMediaSources).mockResolvedValueOnce({
			results: [successful("one"), failed("two")],
		});
		await page.handleSyncAll([source("one"), source("two")]);
		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledExactlyOnceWith(
			"Sync failed for 1 of 2 sources",
		);
	});

	it("requires an outcome for every requested source before showing success", async () => {
		const { actions, page } = setup();
		vi.mocked(actions.syncMediaSources).mockResolvedValueOnce({ results: [] });
		await page.handleSyncSource(source("one"));
		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith(
			"Failed to sync one: No synchronization result returned",
		);
	});

	it("keeps the pending guard until all outcomes arrive and clears it on success", async () => {
		const { actions, page } = setup();
		const request =
			Promise.withResolvers<
				Awaited<ReturnType<SourcesPageActions["syncMediaSources"]>>
			>();
		vi.mocked(actions.syncMediaSources).mockReturnValueOnce(request.promise);
		const syncing = page.handleSyncSource(source("one"));
		expect(page.isSyncing()).toBe(true);
		await page.handleSyncAll([source("two")]);
		expect(actions.syncMediaSources).toHaveBeenCalledExactlyOnceWith(["one"]);
		request.resolve({ results: [successful("one")] });
		await syncing;
		expect(page.isSyncing()).toBe(false);
		expect(toast.success).toHaveBeenCalledExactlyOnceWith(
			"Sync finished for one",
		);
	});
});
