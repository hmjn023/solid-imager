import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import type { QueryClient } from "@tanstack/solid-query";
import { createSignal, onCleanup } from "solid-js";
import { toast } from "../toast";

export type SourcesPageActions = {
	createMediaSource: (data: unknown) => Promise<unknown>;
	updateMediaSource: (id: string, data: unknown) => Promise<unknown>;
	deleteMediaSource: (id: string) => Promise<unknown>;
	syncMediaSources: (ids: string[]) => Promise<unknown>;
};

export type SourcesEventHandlers = {
	onAllJobsCompleted: (data: { sourceId: string; processed?: number }) => void;
	onWatcherError: (data: { sourceId: string; error?: string }) => void;
};

export type UseSourcesPageOptions = {
	actions: SourcesPageActions;
	queryClient: QueryClient;
	invalidateQueryKey: string;
	registerEvents?: (handlers: SourcesEventHandlers) => () => void;
};

export type UseSourcesPageResult = {
	showFormModal: () => boolean;
	setShowFormModal: (v: boolean) => void;
	showDeleteModal: () => boolean;
	setShowDeleteModal: (v: boolean) => void;
	editingSource: () => SafeMediaSource | MediaSourceInfo | null;
	deletingSource: () => SafeMediaSource | MediaSourceInfo | null;
	isSyncing: () => boolean;
	handleAddSource: () => void;
	handleEditSource: (source: SafeMediaSource | MediaSourceInfo) => void;
	handleFormSubmit: (sourceData: unknown) => Promise<void>;
	handleDeleteSource: (source: SafeMediaSource | MediaSourceInfo) => void;
	handleDeleteConfirm: (mediaSourceId: string) => Promise<void>;
	handleSyncSource: (
		source: SafeMediaSource | MediaSourceInfo,
	) => Promise<void>;
	handleSyncAll: (sources: SafeMediaSource[] | undefined) => Promise<void>;
};

export function useSourcesPage(
	options: UseSourcesPageOptions,
): UseSourcesPageResult {
	const { actions, queryClient, invalidateQueryKey, registerEvents } = options;

	const [showFormModal, setShowFormModal] = createSignal(false);
	const [showDeleteModal, setShowDeleteModal] = createSignal(false);
	const [editingSource, setEditingSource] = createSignal<
		SafeMediaSource | MediaSourceInfo | null
	>(null);
	const [deletingSource, setDeletingSource] = createSignal<
		SafeMediaSource | MediaSourceInfo | null
	>(null);
	const [isSyncing, setIsSyncing] = createSignal(false);

	const invalidate = () => {
		void queryClient.invalidateQueries({ queryKey: [invalidateQueryKey] });
	};

	if (registerEvents) {
		const cleanup = registerEvents({
			onAllJobsCompleted: () => {
				invalidate();
			},
			onWatcherError: (data) => {
				toast.error(
					`Watcher Error for ${data.sourceId.slice(0, 4)}...: ${data.error || "Unknown error"}`,
				);
			},
		});
		onCleanup(cleanup);
	}

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
				await actions.updateMediaSource(editing.id, sourceData);
			} else {
				await actions.createMediaSource(sourceData);
			}
			invalidate();
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
		try {
			await actions.deleteMediaSource(mediaSourceId);
			invalidate();
			setShowDeleteModal(false);
			setDeletingSource(null);
		} catch (error) {
			toast.error(
				`Failed to delete source: ${error instanceof Error ? error.message : String(error)}`,
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
			await actions.syncMediaSources([source.id]);
			toast.success(`Sync finished for ${source.name}`);
		} catch (error) {
			toast.error(
				`Failed to sync ${source.name}: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setIsSyncing(false);
		}
	};

	const handleSyncAll = async (sources: SafeMediaSource[] | undefined) => {
		if (!sources || sources.length === 0 || isSyncing()) {
			return;
		}

		setIsSyncing(true);
		toast.info("Starting sync for all sources...");
		try {
			const ids = sources.map((s) => s.id).filter(Boolean) as string[];
			await actions.syncMediaSources(ids);
			toast.success("Sync finished for all sources");
		} catch (error) {
			toast.error(
				`Failed to sync all sources: ${error instanceof Error ? error.message : String(error)}`,
			);
		} finally {
			setIsSyncing(false);
		}
	};

	return {
		showFormModal,
		setShowFormModal,
		showDeleteModal,
		setShowDeleteModal,
		editingSource,
		deletingSource,
		isSyncing,
		handleAddSource,
		handleEditSource,
		handleFormSubmit,
		handleDeleteSource,
		handleDeleteConfirm,
		handleSyncSource,
		handleSyncAll,
	};
}
