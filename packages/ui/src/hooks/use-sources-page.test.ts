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
const failed = (id: string, failureKind: "partial" | "fatal" = "fatal") => ({
	id,
	sourceId: id,
	success: false as const,
	failureKind,
	added: 1,
	deleted: 0,
	failed: 1,
	error:
		failureKind === "partial"
			? "Directory sync failed"
			: "Source path is not accessible",
});

describe("source synchronization feedback", () => {
	it.each(["partial", "fatal"] as const)(
		"reports a fulfilled RPC's %s result instead of showing success",
		async (failureKind) => {
			const { actions, page, invalidate } = setup();
			const outcome = failed("one", failureKind);
			vi.mocked(actions.syncMediaSources).mockResolvedValueOnce({
				results: [outcome],
			});
			await page.handleSyncSource(source("one"));
			expect(toast.success).not.toHaveBeenCalled();
			expect(toast.error).toHaveBeenCalledExactlyOnceWith(
				`oneの同期に失敗しました: ${outcome.error}`,
			);
			expect(invalidate).toHaveBeenCalledOnce();
			expect(page.isSyncing()).toBe(false);
		},
	);

	it("reports how many sources failed after a partially successful batch", async () => {
		const { actions, page } = setup();
		vi.mocked(actions.syncMediaSources).mockResolvedValueOnce({
			results: [successful("one"), failed("two")],
		});
		await page.handleSyncAll([source("one"), source("two")]);
		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledExactlyOnceWith(
			"2ソース中1ソースの同期に失敗しました",
		);
	});

	it("requires an outcome for every requested source before showing success", async () => {
		const { actions, page } = setup();
		vi.mocked(actions.syncMediaSources).mockResolvedValueOnce({ results: [] });
		await page.handleSyncSource(source("one"));
		expect(toast.success).not.toHaveBeenCalled();
		expect(toast.error).toHaveBeenCalledWith(
			"oneの同期に失敗しました: 同期結果が返されませんでした",
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
			"oneの同期が完了しました",
		);
	});
});

describe("source deletion confirmation", () => {
	it("ignores duplicate confirm calls while deletion is in flight", async () => {
		const { actions, page, invalidate } = setup();
		const request = Promise.withResolvers<unknown>();
		vi.mocked(actions.deleteMediaSource).mockReturnValueOnce(request.promise);

		page.handleDeleteSource(source("one"));
		expect(page.showDeleteModal()).toBe(true);
		expect(page.deletingSource()?.id).toBe("one");

		const deleting = page.handleDeleteConfirm("one");
		expect(page.isDeleting()).toBe(true);

		await page.handleDeleteConfirm("one");
		expect(actions.deleteMediaSource).toHaveBeenCalledExactlyOnceWith("one");

		request.resolve(undefined);
		await deleting;

		expect(page.isDeleting()).toBe(false);
		expect(page.showDeleteModal()).toBe(false);
		expect(page.deletingSource()).toBeNull();
		expect(invalidate).toHaveBeenCalledOnce();
	});

	it("preserves source B confirmation state if source A deletion finishes after switching to B", async () => {
		const { actions, page } = setup();
		const requestA = Promise.withResolvers<unknown>();
		vi.mocked(actions.deleteMediaSource)
			.mockReturnValueOnce(requestA.promise)
			.mockResolvedValueOnce(undefined);

		page.handleDeleteSource(source("one"));
		const deletingA = page.handleDeleteConfirm("one");

		page.setShowDeleteModal(false);
		page.handleDeleteSource(source("two"));
		expect(page.showDeleteModal()).toBe(true);
		expect(page.deletingSource()?.id).toBe("two");

		requestA.resolve(undefined);
		await deletingA;

		expect(page.isDeleting()).toBe(false);
		expect(page.showDeleteModal()).toBe(true);
		expect(page.deletingSource()?.id).toBe("two");

		await page.handleDeleteConfirm("two");
		expect(actions.deleteMediaSource).toHaveBeenCalledTimes(2);
		expect(actions.deleteMediaSource).toHaveBeenNthCalledWith(2, "two");
		expect(page.showDeleteModal()).toBe(false);
		expect(page.deletingSource()).toBeNull();
	});
});
