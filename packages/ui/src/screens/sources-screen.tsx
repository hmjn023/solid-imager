import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import type { JSX } from "solid-js";
import { For, Show } from "solid-js";
import type { UseSourcesPageResult } from "../hooks/use-sources-page";

export type SourcesScreenProps = {
	page: UseSourcesPageResult;
	mediaSources: () => (SafeMediaSource | MediaSourceInfo)[] | undefined;
	isLoading: boolean;
	isError: boolean;
	error: Error | null;
	renderSourceCard: (
		source: SafeMediaSource | MediaSourceInfo,
	) => JSX.Element;
	renderFormModal: (props: {
		editingSource: SafeMediaSource | MediaSourceInfo | null;
		isOpen: boolean;
		onClose: () => void;
		onSubmit: (data: unknown) => Promise<void>;
	}) => JSX.Element;
	renderDeleteModal: (props: {
		isOpen: boolean;
		onClose: () => void;
		onConfirm: (mediaSourceId: string) => Promise<void>;
		sourceToDelete: SafeMediaSource | MediaSourceInfo | null;
	}) => JSX.Element;
};

export function SourcesScreen(props: SourcesScreenProps) {
	const page = () => props.page;

	return (
		<div class="container mx-auto p-6">
			<div class="mb-6 flex items-center justify-between">
				<h1 class="font-bold text-3xl">Media Sources</h1>
				<div class="flex items-center gap-2">
					<button
						class="rounded bg-green-500 px-4 py-2 text-white shadow hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={page().isSyncing() || !props.mediaSources()?.length}
						onClick={() => page().handleSyncAll(props.mediaSources())}
						type="button"
					>
						{page().isSyncing() ? "Syncing..." : "Sync All"}
					</button>
					<button
						class="rounded bg-blue-500 px-4 py-2 text-white shadow hover:bg-blue-600"
						onClick={() => page().handleAddSource()}
						type="button"
					>
						Add Source
					</button>
				</div>
			</div>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<For each={props.mediaSources()}>
					{(source) => props.renderSourceCard(source)}
				</For>
			</div>

			<Show when={props.isLoading}>
				<div class="mt-8 text-center">
					<p class="text-muted-foreground">Loading sources...</p>
				</div>
			</Show>

			<Show when={props.isError}>
				<div class="mt-8 text-center">
					<p class="text-red-500">
						Error loading sources: {props.error?.message}
					</p>
				</div>
			</Show>

			{props.renderFormModal({
				editingSource: page().editingSource(),
				isOpen: page().showFormModal(),
				onClose: () => page().setShowFormModal(false),
				onSubmit: page().handleFormSubmit,
			})}

			{props.renderDeleteModal({
				isOpen: page().showDeleteModal(),
				onClose: () => page().setShowDeleteModal(false),
				onConfirm: page().handleDeleteConfirm,
				sourceToDelete: page().deletingSource(),
			})}
		</div>
	);
}
