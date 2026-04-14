import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { listen } from "@tauri-apps/api/event";
import { createEffect, createSignal, For, onCleanup } from "solid-js";
import { SourceCard } from "../../components/source-card";
import { SourceDeleteModal } from "../../components/source-delete-modal";
import { SourceFormModal } from "../../components/source-form-modal";
import { mediaSourcesQueryOptions } from "../../infrastructure/api-clients/queries/sources-query";
import {
	createMediaSource,
	deleteMediaSource,
	syncMediaSources,
	updateMediaSource,
} from "../../infrastructure/api-clients/sources-api";

export const Route = createFileRoute("/sources/")({
	loader: async ({ context }) => {
		await context.queryClient.ensureQueryData(mediaSourcesQueryOptions());
	},
	component: SourcesRoute,
});

function SourcesRoute() {
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
		try {
			const editing = editingSource();
			if (editing?.id) {
				await updateMediaSource(editing.id, sourceData as any);
			} else {
				await createMediaSource(sourceData as any);
			}
			await queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
			setShowFormModal(false);
		} catch (error) {
			toast.error(
				`Failed to save source: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	};

	const handleDeleteSource = (source: SafeMediaSource | MediaSourceInfo) => {
		setDeletingSource(source);
		setShowDeleteModal(true);
	};

	const handleDeleteConfirm = async (mediaSourceId: string) => {
		await deleteMediaSource(mediaSourceId);
		await queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
		setShowDeleteModal(false);
		setDeletingSource(null);
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
		} catch (error) {
			toast.error(`Failed to sync ${source.name}: ${(error as Error).message}`);
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
			const ids = sources
				.map((source) => source.id)
				.filter(Boolean) as string[];
			await syncMediaSources(ids);
		} catch (error) {
			toast.error(`Failed to sync all sources: ${(error as Error).message}`);
		} finally {
			setIsSyncing(false);
		}
	};

	createEffect(() => {
		const sources = mediaSources.data;
		if (!sources?.length) {
			return;
		}

		const sourceIds = new Set(
			sources
				.map((source) => source.id)
				.filter((id): id is string => Boolean(id)),
		);
		const unlistenPromises = [
			listen("all-jobs-completed", (event) => {
				const payload = event.payload as {
					mediaSourceId?: string;
					processed?: number;
				};
				if (!(payload.mediaSourceId && sourceIds.has(payload.mediaSourceId))) {
					return;
				}
				toast.success(
					`Jobs for source ${payload.mediaSourceId.slice(0, 4)}... completed! Processed: ${payload.processed ?? "N/A"}`,
				);
				void queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
			}),
			listen("watcher-error", (event) => {
				const payload = event.payload as {
					mediaSourceId?: string;
					error?: string;
				};
				if (!(payload.mediaSourceId && sourceIds.has(payload.mediaSourceId))) {
					return;
				}
				toast.error(
					`Watcher Error for ${payload.mediaSourceId.slice(0, 4)}...: ${payload.error || "Unknown error"}`,
				);
			}),
		];

		onCleanup(() => {
			void Promise.all(unlistenPromises).then((unlisteners) => {
				for (const unlisten of unlisteners) {
					unlisten();
				}
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
