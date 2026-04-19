import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { toast } from "@solid-imager/ui/toast";
import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/sources/")({
	ssr: true,
	beforeLoad: ({ context }) => {
		void context;
	},
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(mediaSourcesQueryOptions());
	},
	component: Sources,
});

import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createEffect, createSignal, For, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";
import SourceCard from "~/components/source-card";
import SourceDeleteModal from "~/components/source-delete-modal";
import SourceFormModal from "~/components/source-form-modal";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { mediaSourcesQueryOptions } from "~/infrastructure/api-clients/queries/sources-query";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";
import { logger } from "~/infrastructure/logger";

const UUID_PREFIX_LENGTH = 4;

/**
 * The main component for managing media sources.
 * It displays a list of media sources, and provides functionality to add, edit, and delete them.
 * @returns {JSX.Element} The rendered media sources management page.
 */
export default function Sources() {
	const [showFormModal, setShowFormModal] = createSignal(false);
	const [showDeleteModal, setShowDeleteModal] = createSignal(false);
	const [editingSource, setEditingSource] = createSignal<
		SafeMediaSource | MediaSourceInfo | null
	>(null);
	const [deletingSource, setDeletingSource] = createSignal<
		SafeMediaSource | MediaSourceInfo | null
	>(null);
	const [isSyncing, setIsSyncing] = createSignal(false);

	const queryClient = useQueryClient();
	const mediaSources = createQuery(() => mediaSourcesQueryOptions());

	const handleAddSource = () => {
		setEditingSource(null);
		setShowFormModal(true);
	};

	const handleEditSource = (source: SafeMediaSource | MediaSourceInfo) => {
		setEditingSource(source);
		setShowFormModal(true);
	};

	const handleFormSubmit = async (sourceData: unknown) => {
		const editing = editingSource();
		try {
			if (editing?.id) {
				await updateMediaSource(editing.id, sourceData as any);
			} else {
				await createMediaSource(sourceData as any);
			}
			await queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
			setShowFormModal(false);
		} catch (error) {
			logger.error({ err: error }, "Failed to submit source form");
		}
	};

	const handleDeleteSource = (source: SafeMediaSource | MediaSourceInfo) => {
		setDeletingSource(source);
		setShowDeleteModal(true);
	};

	const handleDeleteConfirm = async (mediaSourceId: string) => {
		try {
			await deleteMediaSource(mediaSourceId);
			await queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
			setShowDeleteModal(false);
			setDeletingSource(null);
		} catch (error) {
			logger.error(
				{ err: error, mediaSourceId },
				"Failed to delete media source",
			);
		}
	};

	const handleSyncSource = async (
		source: SafeMediaSource | MediaSourceInfo,
	) => {
		if (!source.id || isSyncing()) {
			return;
		}
		setIsSyncing(true);
		toast.info(`Starting sync for ${source.name}...`);
		try {
			await syncMediaSources([source.id]);
			toast.success(`Sync finished for ${source.name}`);
		} catch (error) {
			logger.error(
				{ err: error, sourceId: source.id },
				"Failed to sync media source",
			);
			toast.error(`Failed to sync ${source.name}`);
		} finally {
			setIsSyncing(false);
		}
	};

	const handleSyncAll = async () => {
		const sources = mediaSources.data;
		if (!sources || sources.length === 0 || isSyncing()) {
			return;
		}

		setIsSyncing(true);
		toast.info("Starting sync for all sources...");
		try {
			const ids = sources.map((s) => s.id).filter(Boolean) as string[];
			await syncMediaSources(ids);
			toast.success("Sync finished for all sources");
		} catch (error) {
			logger.error({ err: error }, "Failed to sync all media sources");
			toast.error("Failed to sync all sources");
		} finally {
			setIsSyncing(false);
		}
	};

	// SSE setup using oRPC
	onMount(() => {
		if (isServer) {
			return;
		}

		// Watch for changes in mediaSources data and setup SSE
		createEffect(() => {
			const sources = mediaSources.data;
			if (!sources) {
				return;
			}

			// Create a controller for this effect run (cancels previous run's streams)
			const ac = new AbortController();

			const startStreamForSource = async (id: string) => {
				try {
					const events = await orpc.sources.events(
						{ id },
						{ signal: ac.signal },
					);

					for await (const msg of events) {
						if (ac.signal.aborted) {
							break;
						}

						const { event, data } = msg;

						switch (event) {
							case "all-jobs-completed":
								toast.success(
									`Jobs for source ${id.substring(
										0,
										UUID_PREFIX_LENGTH,
									)}... completed! Processed: ${data?.processed}`,
								);
								queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
								break;
							case "watcher-error":
								toast.error(
									`Watcher Error for ${id.substring(
										0,
										UUID_PREFIX_LENGTH,
									)}...: ${data?.error || "Unknown error"}`,
								);
								break;
							default:
								break;
						}
					}
				} catch (err) {
					if (!ac.signal.aborted) {
						logger.error({ err }, "Event stream error");
					}
				}
			};

			for (const source of sources) {
				if (source.id) {
					startStreamForSource(source.id);
				}
			}

			// Cleanup function run before next effect or on unmount
			onCleanup(() => {
				ac.abort();
			});
		});
	});

	return (
		<div class="container mx-auto p-6">
			<div class="mb-6 flex items-center justify-between">
				<h1 class="font-bold text-3xl">Media Sources</h1>
				<div class="flex items-center gap-2">
					<button
						class="rounded bg-green-500 px-4 py-2 text-white shadow hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isSyncing() || !mediaSources.data?.length}
						onClick={handleSyncAll}
						type="button"
					>
						{isSyncing() ? "Syncing..." : "Sync All"}
					</button>
					<button
						class="rounded bg-blue-500 px-4 py-2 text-white shadow hover:bg-blue-600"
						onClick={() => handleAddSource()}
						type="button"
					>
						Add Source
					</button>
				</div>
			</div>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<For each={mediaSources.data}>
					{(source) => (
						<SourceCard
							mediaSource={source}
							onDelete={handleDeleteSource}
							onEdit={handleEditSource}
							onSync={handleSyncSource}
						/>
					)}
				</For>
			</div>

			{mediaSources.isLoading && (
				<div class="mt-8 text-center">
					<p class="text-muted-foreground">Loading sources...</p>
				</div>
			)}

			{mediaSources.isError && (
				<div class="mt-8 text-center">
					<p class="text-red-500">
						Error loading sources: {mediaSources.error?.message}
					</p>
				</div>
			)}

			<SourceFormModal
				editingSource={editingSource()}
				isOpen={showFormModal()}
				onClose={() => setShowFormModal(false)}
				onSubmit={handleFormSubmit}
			/>

			<SourceDeleteModal
				isOpen={showDeleteModal()}
				onClose={() => setShowDeleteModal(false)}
				onConfirm={handleDeleteConfirm}
				sourceToDelete={deletingSource()}
			/>
		</div>
	);
}
