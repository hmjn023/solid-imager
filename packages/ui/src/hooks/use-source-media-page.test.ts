import { QueryClient } from "@tanstack/solid-query";
import { createRoot } from "solid-js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRestoreImportStrategies } from "./restore-import";
import {
	useSourceMediaPage,
	type SourceMediaPageActions,
	type SourceMediaPagePresetClient,
	type SourceMediaPageQueryStates,
} from "./use-source-media-page";

vi.mock("solid-js", async () =>
	vi.importActual<typeof import("solid-js")>("solid-js/dist/solid.js"),
);
vi.mock("@tanstack/solid-query", async () => {
	const actual = await vi.importActual<typeof import("@tanstack/solid-query")>(
		"@tanstack/solid-query",
	);
	return {
		...actual,
		createInfiniteQuery: vi.fn(() => ({
			dataUpdatedAt: 0,
			isPlaceholderData: false,
			error: null,
			status: "success" as const,
			fetchStatus: "idle" as const,
			isLoading: false,
			hasNextPage: false,
			isFetchingNextPage: false,
			isFetchNextPageError: false,
			refetch: vi.fn(),
		})),
	};
});
vi.mock("./scroll-container", () => ({
	scrollToPosition: vi.fn(),
	useScrollRestoration: vi.fn(),
}));
vi.mock("./use-media-source-events", () => ({
	useMediaSourceEvents: vi.fn(),
}));
vi.mock("../toast", () => ({
	toast: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
}));

const disposers: Array<() => void> = [];
beforeEach(() => {
	vi.clearAllMocks();
	vi.stubGlobal("document", {
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
	});
});
afterEach(() => {
	disposers.splice(0).forEach((dispose) => dispose());
	vi.unstubAllGlobals();
});

function setupSourceMediaPage() {
	return createRoot((dispose) => {
		disposers.push(dispose);
		const actions: SourceMediaPageActions = {
			searchSemantic: vi.fn(),
			searchMedia: vi.fn(),
			uploadMedia: vi.fn(),
			deleteMedia: vi.fn(),
			copyMedia: vi.fn(),
			moveMedia: vi.fn(),
			syncMediaItems: vi.fn(),
			startDownloadJobs: vi.fn(),
		};
		const emptyState = {
			phase: "empty" as const,
			fetchState: "idle" as const,
			data: [],
			error: null,
		};
		const queryStates = (): SourceMediaPageQueryStates => ({
			tags: emptyState,
			projects: emptyState,
			ips: emptyState,
			characters: emptyState,
			authors: emptyState,
		});
		const presetClient: SourceMediaPagePresetClient = {
			list: vi.fn(),
			create: vi.fn(),
			delete: vi.fn(),
		};
		const page = useSourceMediaPage({
			mediaSourceId: () => "source-1",
			queries: {
				tags: () => [],
				projects: () => [],
				ips: () => [],
				characters: () => [],
				authors: () => [],
			},
			queryStates,
			actions,
			queryClient: new QueryClient(),
			presetClient,
			transport: { listen: () => () => {} },
			getSearchCondition: () => undefined,
			sortBy: () => "date",
			sortOrder: () => "desc",
		});
		return { actions, page };
	});
}

describe("getRestoreImportStrategies", () => {
	it("detects tar archives", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.tar", type: "application/x-tar" } as File,
				{},
			),
		).toEqual(["tar"]);
	});

	it("detects ndjson files only when NDJSON import is available", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.ndjson", type: "application/x-ndjson" } as File,
				{ canImportNdjson: true },
			),
		).toEqual(["ndjson"]);
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.ndjson", type: "application/x-ndjson" } as File,
				{ canImportNdjson: false },
			),
		).toEqual(["unsupported"]);
	});

	it("marks JSON dump files as unsupported", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.json", type: "application/json" } as File,
				{},
			),
		).toEqual(["unsupported"]);
	});

	it("marks unknown file types as unsupported", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.bin", type: "application/octet-stream" } as File,
				{},
			),
		).toEqual(["unsupported"]);
	});
});

describe("useSourceMediaPage delete confirmation", () => {
	it("prevents duplicate deleteMedia requests when confirmDelete is called repeatedly while pending", async () => {
		const { actions, page } = setupSourceMediaPage();
		const request = Promise.withResolvers<unknown>();
		vi.mocked(actions.deleteMedia).mockReturnValueOnce(request.promise);

		page.handleDelete("media-a");
		expect(page.deleteDialogOpen()).toBe(true);

		const firstConfirm = page.confirmDelete();
		expect(page.isDeletingMedia()).toBe(true);

		await page.confirmDelete();
		expect(actions.deleteMedia).toHaveBeenCalledExactlyOnceWith(
			"source-1",
			"media-a",
		);

		request.resolve(undefined);
		await firstConfirm;

		expect(page.isDeletingMedia()).toBe(false);
		expect(page.deleteDialogOpen()).toBe(false);
	});

	it("preserves media B confirmation state if media A deletion finishes after A -> cancel -> B", async () => {
		const { actions, page } = setupSourceMediaPage();
		const requestA = Promise.withResolvers<unknown>();
		vi.mocked(actions.deleteMedia)
			.mockReturnValueOnce(requestA.promise)
			.mockResolvedValueOnce(undefined);

		page.handleDelete("media-a");
		const deletingA = page.confirmDelete();

		page.setDeleteDialogOpen(false);
		page.handleDelete("media-b");
		expect(page.deleteDialogOpen()).toBe(true);

		requestA.resolve(undefined);
		await deletingA;

		expect(page.isDeletingMedia()).toBe(false);
		expect(page.deleteDialogOpen()).toBe(true);

		await page.confirmDelete();
		expect(actions.deleteMedia).toHaveBeenCalledTimes(2);
		expect(actions.deleteMedia).toHaveBeenNthCalledWith(
			2,
			"source-1",
			"media-b",
		);
		expect(page.deleteDialogOpen()).toBe(false);
	});
});
