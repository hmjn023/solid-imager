import { defaultState } from "@solid-imager/core/domain/search/schema";
import { searchSnapshotStateSchema } from "@solid-imager/core/domain/search/history";
import {
	mediaDetailsQueryKeys,
	searchQueryKeys,
	sourceMediaQueryKeys,
	sourcesQueryKeys,
} from "@solid-imager/ui/query-options";
import { searchState } from "@solid-imager/ui/stores/search-store";
import {
	saveMediaContext,
	clearMediaReturnPath,
} from "@solid-imager/ui/media-context";
import { toast } from "@solid-imager/ui/toast";
import type { QueryClient } from "@tanstack/solid-query";
import { z } from "zod";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { mediaDetailsQueryOptions } from "~/infrastructure/api-clients/queries";
import { mediaToolInputs } from "@solid-imager/core/domain/media/tool-schemas";
import { afterWebViewPaint, readWebView, waitForWebView } from "./web-view";

function defineTool<Schema extends z.ZodObject, Result extends object>(
	name: string,
	description: string,
	readOnly: boolean,
	inputSchema: Schema,
	run: (input: z.output<Schema>, signal: AbortSignal) => Promise<Result>,
) {
	return {
		name,
		description,
		readOnly,
		inputSchema,
		execute: (input: unknown, signal: AbortSignal) =>
			run(inputSchema.parse(input), signal),
	};
}

const pageSchema = z.strictObject({
	limit: z.int().min(1).max(5).default(5),
	offset: z.int().nonnegative().default(0),
});

function pageOf<T>(items: T[], offset = 0, limit = 5, total = items.length) {
	const page: T[] = [];
	for (const item of items.slice(offset, offset + limit)) {
		if (JSON.stringify([...page, item]).length > 1000) break;
		page.push(item);
	}
	return {
		items: page,
		total_count: total,
		page_size: page.length,
		next_offset:
			page.length > 0 && offset + page.length < items.length
				? offset + page.length
				: null,
	};
}

class WebToolError extends Error {
	constructor(
		message: string,
		readonly code: string,
	) {
		super(message);
	}
}

export async function registerWebTools(
	context: WebMCP.ModelContext,
	queryClient: QueryClient,
	navigation: {
		pathname: () => string;
		openSearch: (id: string) => Promise<void>;
		openMedia: (sourceId: string, mediaId: string) => Promise<void>;
	},
	signal: AbortSignal,
) {
	if (signal.aborted) return;

	const canChangeView = () => {
		if (document.querySelector('[role="dialog"], [role="alertdialog"]')) {
			throw new WebToolError(
				"An editor or dialog is open. Ask the user to finish or close it before changing the view.",
				"VIEW_BUSY",
			);
		}
		if (navigation.pathname() === "/config") {
			throw new WebToolError(
				"Settings may contain unsaved changes. Ask the user to finish editing and leave Settings first.",
				"VIEW_BUSY",
			);
		}
	};

	const openMedia = async (
		location: z.infer<typeof mediaToolInputs.get_media_details>,
		execution: AbortSignal,
	) => {
		canChangeView();
		// Refresh even an already-open item so HTTP edits are reflected too.
		await queryClient.query({
			...mediaDetailsQueryOptions(location.sourceId, location.mediaId),
			staleTime: 0,
			queryFn: () => orpc.media.getDetails(location, { signal: execution }),
		});
		execution.throwIfAborted();
		const view = readWebView();
		if (view?.kind === "search") {
			saveMediaContext(
				`${window.location.pathname}${window.location.search}${window.location.hash}`,
				view.media,
			);
		} else if (view?.kind !== "media") {
			clearMediaReturnPath();
		}
		if (
			view?.kind !== "media" ||
			view.media.id !== location.mediaId ||
			view.media.mediaSourceId !== location.sourceId
		) {
			canChangeView();
			await navigation.openMedia(location.sourceId, location.mediaId);
		}
		await waitForWebView(
			(view) =>
				view.kind === "media" &&
				view.media.id === location.mediaId &&
				view.media.mediaSourceId === location.sourceId,
			execution,
		);
	};

	const currentView = (offset = 0, limit = 5) => {
		const view = readWebView();
		if (view?.kind === "media") {
			const media = view.media;
			return {
				view: "media",
				id: media.id,
				sourceId: media.mediaSourceId,
				fileName: media.fileName.slice(0, 120),
				width: media.width,
				height: media.height,
				tags: pageOf(
					media.tags.map(({ id, name, type }) => ({
						id,
						name: name.slice(0, 60),
						type,
					})),
					offset,
					limit,
				),
			};
		}
		if (view?.kind === "search") {
			return {
				view: "search",
				ready:
					view.ready &&
					view.resultsCurrent &&
					["data", "empty"].includes(view.state.phase),
				query: searchState.searchQuery.slice(0, 160),
				sourceId: searchState.selectedSource || null,
				selected_count: view.selectedIds.length,
				...pageOf(
					view.media.map(({ id, mediaSourceId, fileName }) => ({
						id,
						sourceId: mediaSourceId,
						fileName: fileName.slice(0, 60),
						selected: view.selectedIds.includes(id),
					})),
					offset,
					limit,
					view.total,
				),
			};
		}
		return { view: "other", path: navigation.pathname() };
	};

	const tools = [
		defineTool(
			"get_current_view",
			"Inspect the open image or loaded search results and selection. Use to understand what the user is looking at before acting.",
			true,
			pageSchema,
			async ({ offset, limit }) => currentView(offset, limit),
		),
		defineTool(
			"search_media",
			"Search the library and show the results in this tab, replacing the current filters. Use when the user wants to find images together. Returns a brief result page; inspect more with get_current_view.",
			false,
			mediaToolInputs.search_media.omit({ limit: true, offset: true }),
			async ({ query, tags, sourceId }, execution) => {
				canChangeView();
				const state = searchSnapshotStateSchema.parse({
					...defaultState,
					searchQuery: query,
					selectedTags: tags,
					selectedSource: sourceId ?? "",
				});
				const snapshot = await orpc.searchSnapshots.capture(
					{ state },
					{ signal: execution },
				);
				execution.throwIfAborted();
				canChangeView();
				await navigation.openSearch(snapshot.id);
				await waitForWebView(
					(view) =>
						view.kind === "search" &&
						view.snapshotId === snapshot.id &&
						view.searchKey === JSON.stringify(state) &&
						view.ready &&
						(view.resultsCurrent ||
							["error", "offline"].includes(view.state.phase)) &&
						["data", "empty", "error", "offline"].includes(view.state.phase) &&
						view.state.fetchState !== "background-fetching",
					execution,
				);
				const view = readWebView();
				if (
					view?.kind !== "search" ||
					view.snapshotId !== snapshot.id ||
					view.searchKey !== JSON.stringify(state) ||
					!view.resultsCurrent ||
					view.state.error ||
					!["data", "empty"].includes(view.state.phase)
				) {
					throw new WebToolError(
						"Search could not load. Check the connection and retry.",
						"SEARCH_FAILED",
					);
				}
				return currentView();
			},
		),
		defineTool(
			"open_media",
			"Open an image and its metadata in this tab. Use when the user wants to inspect an image from the search results.",
			false,
			mediaToolInputs.get_media_details,
			async (location, execution) => {
				await openMedia(location, execution);
				return currentView();
			},
		),
		defineTool(
			"edit_media_tags",
			"Open the target image, add or remove its tags, and show the updated tags. Use when the user asks to change an image's tags.",
			false,
			mediaToolInputs.edit_media_tags,
			async (input, execution) => {
				await openMedia(input, execution);
				execution.throwIfAborted();
				const result = await orpc.tools.edit_media_tags(input, {
					signal: execution,
				});
				await Promise.all(
					[
						mediaDetailsQueryKeys.detail(input.sourceId, input.mediaId),
						sourceMediaQueryKeys.forSource(input.sourceId),
						searchQueryKeys.all(),
					].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
				);
				await waitForWebView(
					(view) =>
						view.kind === "media" &&
						view.media.id === input.mediaId &&
						input.tagIds.every((id) =>
							input.action === "add"
								? view.media.tags.some(
										(tag) => tag.id === id && tag.type === "positive",
									)
								: !view.media.tags.some((tag) => tag.id === id),
						),
					execution,
				);
				return result;
			},
		),
		defineTool(
			"find_tags",
			"Find existing tags by name. Use to choose tag IDs before editing an image.",
			true,
			mediaToolInputs.find_tags.extend(pageSchema.shape),
			async (input, execution) => {
				const result = await orpc.tools.find_tags(input, { signal: execution });
				return {
					tags: result.tags.map(({ id, name }) => ({
						id,
						name: name.slice(0, 80),
					})),
					total_count: result.total,
					page_size: result.tags.length,
					next_offset:
						input.offset + result.tags.length < result.total
							? input.offset + result.tags.length
							: null,
				};
			},
		),
		defineTool(
			"list_sources",
			"List registered sources. Use to choose a source before searching or check for an existing directory before registering one.",
			true,
			pageSchema,
			async ({ offset, limit }, execution) => {
				const result = await orpc.tools.list_sources({}, { signal: execution });
				return pageOf(
					result.sources.map(({ id, name, type, connectionInfo }) => ({
						id,
						name: name.slice(0, 80),
						type,
						...(type === "local" && "path" in connectionInfo
							? {
									directory: connectionInfo.path.slice(0, 180),
									directory_truncated: connectionInfo.path.length > 180,
								}
							: {}),
					})),
					offset,
					limit,
				);
			},
		),
		defineTool(
			"create_local_source",
			"Register a local directory on the server and show it in the sources list. Check list_sources first to avoid duplicates.",
			false,
			mediaToolInputs.create_local_source,
			async (input, execution) => {
				const { source } = await orpc.tools.create_local_source(input, {
					signal: execution,
				});
				await queryClient.invalidateQueries({
					queryKey: sourcesQueryKeys.all(),
				});
				await afterWebViewPaint(execution);
				return {
					source: {
						id: source.id,
						name: source.name.slice(0, 120),
						type: source.type,
					},
					scan: "started",
				};
			},
		),
	];

	const labels: Record<string, string> = {
		get_current_view: "現在の画面を確認",
		search_media: "メディアを検索",
		open_media: "画像の詳細を表示",
		edit_media_tags: "画像のタグを編集",
		find_tags: "タグを検索",
		list_sources: "ソース一覧を確認",
		create_local_source: "ソースを追加",
	};
	let running = false;
	await Promise.all(
		tools.map((tool) =>
			context.registerTool(
				{
					name: tool.name,
					description: tool.description,
					inputSchema: z.toJSONSchema(tool.inputSchema, { io: "input" }),
					annotations: {
						...(tool.readOnly ? { readOnlyHint: true } : {}),
						...(tool.name !== "edit_media_tags"
							? { untrustedContentHint: true }
							: {}),
					},
					async execute(input, options) {
						if (running)
							return {
								error:
									"Another operation is running. Wait for it to finish before retrying.",
								code: "BUSY",
								retryable: true,
							};
						running = true;
						const execution = AbortSignal.any([signal, options.signal]);
						const id = `webmcp-${crypto.randomUUID()}`;
						const label = labels[tool.name];
						toast.loading(`AI: ${label}中…`, { id });
						try {
							execution.throwIfAborted();
							const result = await tool.execute(input, execution);
							execution.throwIfAborted();
							toast.success(`AI: ${label}しました`, { id });
							return result;
						} catch (error) {
							const canceled = execution.aborted;
							toast.error(
								canceled
									? `AI: ${label}を中断しました`
									: `AI: ${label}できませんでした`,
								{ id },
							);
							return {
								error: canceled
									? "Operation canceled. Inspect the current view before retrying; completed changes may remain."
									: error instanceof z.ZodError
										? z.prettifyError(error).slice(0, 1000)
										: error instanceof WebToolError
											? error.message
											: `Could not finish ${tool.name}. Inspect the current view and check IDs and the server connection before retrying; completed changes may remain.`,
								code: canceled
									? "CANCELED"
									: error instanceof z.ZodError
										? "INVALID_INPUT"
										: error instanceof WebToolError
											? error.code
											: "OPERATION_FAILED",
								retryable: false,
							};
						} finally {
							running = false;
						}
					},
				},
				{ signal },
			),
		),
	);
}
