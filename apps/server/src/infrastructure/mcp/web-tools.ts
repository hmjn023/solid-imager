import {
	ccipExtractionRequestSchema,
	startCcipExtractionResponseSchema,
} from "@solid-imager/core/domain/tagging/schemas";
import {
	viewToolTitles,
	type WebToolInfo,
} from "@solid-imager/core/domain/config/mcp";
import { defaultState } from "@solid-imager/core/domain/search/schema";
import {
	captureSearchSnapshotResponseSchema,
	searchSnapshotStateSchema,
} from "@solid-imager/core/domain/search/history";
import { sourcesQueryKeys } from "@solid-imager/ui/query-options";
import { searchState } from "@solid-imager/ui/stores/search-store";
import { toast } from "@solid-imager/ui/toast";
import type { QueryClient } from "@tanstack/solid-query";
import { z } from "zod";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import type { WorkspaceNavigation } from "~/presentation/workspace-navigation";
import {
	afterCommit,
	createViewActions,
	ViewActionError,
} from "~/presentation/workspace-actions";
import {
	mediaToolInputs,
	mediaToolOutputs,
} from "@solid-imager/core/domain/media/tool-schemas";
import {
	afterWebViewPaint,
	readWorkspaceView,
} from "~/presentation/workspace-view";

function defineTool<Schema extends z.ZodObject, Result extends object>(
	name: string,
	description: string,
	readOnly: boolean,
	inputSchema: Schema,
	run: (
		input: z.output<Schema>,
		signal: AbortSignal,
		origin: string,
	) => Promise<Result>,
) {
	return {
		name,
		description,
		readOnly,
		inputSchema,
		execute: (input: unknown, signal: AbortSignal, origin: string) =>
			run(inputSchema.parse(input), signal, origin),
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

export async function registerWebTools(
	context: WebMCP.ModelContext,
	published: WebToolInfo[],
	queryClient: QueryClient,
	navigation: WorkspaceNavigation,
	signal: AbortSignal,
) {
	if (signal.aborted) return;

	const views = createViewActions(navigation, queryClient);

	const currentView = (offset = 0, limit = 5) => {
		const view = readWorkspaceView();
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
		if (view?.kind === "jobs") {
			const job = view.job;
			return {
				view: "jobs",
				job: job ? { id: job.id, type: job.type, status: job.status } : null,
			};
		}
		return { view: "other", path: navigation.pathname() };
	};

	const tools = [
		defineTool(
			"get_current_view",
			"Inspect the open image, search results and selection, or selected job. Use to understand what the user is looking at before acting.",
			true,
			pageSchema,
			async ({ offset, limit }) => currentView(offset, limit),
		),
		defineTool(
			"search_media",
			"Search the library and show the results in this tab, replacing the current filters. Use when the user wants to find images together. Returns a brief result page; inspect more with get_current_view.",
			false,
			mediaToolInputs.search_media.omit({ limit: true, offset: true }),
			async ({ query, tags, sourceId }, execution, origin) => {
				views.beforeNavigation(execution, origin);
				const state = searchSnapshotStateSchema.parse({
					...defaultState,
					searchQuery: query,
					selectedTags: tags,
					selectedSource: sourceId ?? "",
				});
				const snapshot = captureSearchSnapshotResponseSchema.parse(
					await orpc.config.callWebTool(
						{ name: "search_media_capture_snapshot", arguments: { state } },
						{ signal: execution },
					),
				);
				await views.show(
					{
						kind: "search",
						snapshotId: snapshot.id,
						searchKey: JSON.stringify(state),
					},
					execution,
					origin,
				);
				return currentView();
			},
		),
		defineTool(
			"open_media",
			"Open an image and its metadata in this tab. Use when the user wants to inspect an image from the search results.",
			false,
			mediaToolInputs.get_media_details,
			async (location, execution, origin) => {
				await views.show({ kind: "media", ...location }, execution, origin);
				return currentView();
			},
		),
		defineTool(
			"edit_media_tags",
			"Open the target image, add or remove its tags, and show the updated tags. Use when the user asks to change an image's tags.",
			false,
			mediaToolInputs.edit_media_tags,
			async (input, execution, origin) => {
				const target = {
					kind: "media",
					sourceId: input.sourceId,
					mediaId: input.mediaId,
				} as const;
				await views.show(target, execution, origin);
				views.beforeNavigation(execution);
				const result = mediaToolOutputs.edit_media_tags.parse(
					await orpc.config.callWebTool(
						{ name: "edit_media_tags", arguments: input },
						{ signal: execution },
					),
				);
				return afterCommit(result, () =>
					views.reflectTags(target, input.action, input.tagIds, execution),
				);
			},
		),
		defineTool(
			"ai_startCcipExtraction",
			"Queue CCIP feature extraction for an image. Set showJob when the user wants to follow progress in this tab. Returns the queued job ID.",
			false,
			ccipExtractionRequestSchema.extend({
				showJob: z
					.boolean()
					.default(false)
					.describe("Open the queued job in this tab."),
			}),
			async ({ showJob, ...input }, execution, origin) => {
				if (showJob) views.beforeNavigation(execution, origin);
				const result = startCcipExtractionResponseSchema.parse(
					await orpc.config.callWebTool(
						{ name: "ai_startCcipExtraction", arguments: input },
						{ signal: execution },
					),
				);
				if (!showJob || !result.success) return result;
				return afterCommit(result, () =>
					views.show({ kind: "job", jobId: result.jobId }, execution, origin),
				);
			},
		),
		defineTool(
			"find_tags",
			"Find existing tags by name. Use to choose tag IDs before editing an image.",
			true,
			mediaToolInputs.find_tags.extend(pageSchema.shape),
			async (input, execution) => {
				const result = mediaToolOutputs.find_tags.parse(
					await orpc.config.callWebTool(
						{ name: "find_tags", arguments: input },
						{ signal: execution },
					),
				);
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
				const result = mediaToolOutputs.list_sources.parse(
					await orpc.config.callWebTool(
						{ name: "list_sources", arguments: {} },
						{ signal: execution },
					),
				);
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
				const { source } = mediaToolOutputs.create_local_source.parse(
					await orpc.config.callWebTool(
						{ name: "create_local_source", arguments: input },
						{ signal: execution },
					),
				);
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
		...viewToolTitles,
		ai_startCcipExtraction: "CCIP特徴抽出を登録",
		search_media: "メディアを検索",
		edit_media_tags: "画像のタグを編集",
		find_tags: "タグを検索",
		list_sources: "ソース一覧を確認",
		create_local_source: "ソースを追加",
	};
	let running = false;
	const results = await Promise.allSettled(
		published.map(async (entry) => {
			const tool = tools.find(({ name }) => name === entry.name);
			if (!tool) {
				return context.registerTool(
					{
						name: entry.name,
						title: entry.title,
						description: entry.description,
						inputSchema: entry.inputSchema,
						annotations: {
							untrustedContentHint: true,
							...(entry.readOnly && { readOnlyHint: true }),
						},
						async execute(args, options) {
							try {
								return await orpc.config.callWebTool(
									{ name: entry.name, arguments: args },
									{ signal: AbortSignal.any([signal, options.signal]) },
								);
							} catch (error) {
								return {
									error:
										error instanceof Error ? error.message : "Tool call failed",
									code: "TOOL_FAILED",
								};
							}
						},
					},
					{ signal },
				);
			}
			return context.registerTool(
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
							// Another tab may have unpublished this tool since the last discovery.
							const origin = navigation.href();
							const { mcp } = await orpc.config.get(undefined, {
								signal: execution,
							});
							if (!mcp.web.includes(tool.name))
								throw new ViewActionError(
									"This tool is no longer published.",
									"NOT_PUBLISHED",
								);
							const result = await tool.execute(input, execution, origin);
							if (
								"presentation" in result &&
								result.presentation === "unconfirmed"
							) {
								toast.info(`AI: ${label}しました（画面反映は未確認）`, { id });
								return result;
							}
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
										: error instanceof ViewActionError
											? error.message
											: `Could not finish ${tool.name}. Inspect the current view and check IDs and the server connection before retrying; completed changes may remain.`,
								code: canceled
									? "CANCELED"
									: error instanceof z.ZodError
										? "INVALID_INPUT"
										: error instanceof ViewActionError
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
			);
		}),
	);
	for (const [index, result] of results.entries()) {
		if (result.status === "rejected" && !signal.aborted) {
			console.warn(
				`Could not register WebMCP tool ${published[index]?.name}`,
				result.reason,
			);
		}
	}
}
