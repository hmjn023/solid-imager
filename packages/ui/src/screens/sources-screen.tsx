import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import type { JSX } from "solid-js";
import { For, Match, Switch } from "solid-js";
import {
	EmptyState,
	ErrorState,
	OfflineState,
	QueryStatus,
} from "../async-state";
import { Button } from "../button";
import type { UseSourcesPageResult } from "../hooks/use-sources-page";
import type { QueryUiState } from "../query-state";
import { CardGridSkeleton, LoadingRegion } from "../skeleton";

export type SourcesScreenProps = {
	page: UseSourcesPageResult;
	mediaSources: () => (SafeMediaSource | MediaSourceInfo)[] | undefined;
	state: () => QueryUiState<(SafeMediaSource | MediaSourceInfo)[]>;
	onRetry?: () => void | Promise<void>;
	renderSourceCard: (source: SafeMediaSource | MediaSourceInfo) => JSX.Element;
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
	const errorMessage = () => {
		const error = props.state().error;
		return error instanceof Error ? error.message : "API接続に失敗しました";
	};

	return (
		<div class="container mx-auto p-4 sm:p-6">
			<div class="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
				<h1 class="font-bold text-2xl sm:text-3xl">Media Sources</h1>
				<div class="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
					<Button
						class="w-full sm:w-auto"
						disabled={page().isSyncing() || !props.mediaSources()?.length}
						onClick={() => page().handleSyncAll(props.mediaSources())}
						variant="outline"
					>
						{page().isSyncing() ? "Syncing..." : "Sync All"}
					</Button>
					<Button
						class="w-full sm:w-auto"
						onClick={() => page().handleAddSource()}
					>
						Add Source
					</Button>
				</div>
			</div>

			<QueryStatus
				class="mb-3"
				errorLabel="同期できなかったため、保存済みのソースを表示しています"
				fetchState={props.state().fetchState}
				hasData={props.state().data !== undefined}
				hasError={props.state().error !== undefined}
				offlineLabel="オフラインのため保存済みデータを表示しています"
				updatingLabel="ソース一覧を更新中..."
			/>

			<Switch>
				<Match when={props.state().phase === "pending"}>
					<LoadingRegion label="ソースを読み込んでいます...">
						<CardGridSkeleton />
					</LoadingRegion>
				</Match>
				<Match when={props.state().phase === "error"}>
					<ErrorState
						description={errorMessage()}
						onRetry={props.onRetry}
						title="ソース一覧を読み込めませんでした"
					/>
				</Match>
				<Match when={props.state().phase === "offline"}>
					<OfflineState
						description="接続を確認してから再試行してください。"
						onRetry={props.onRetry}
					/>
				</Match>
				<Match when={props.state().phase === "empty"}>
					<EmptyState
						description="画像を管理するメディアソースを追加してください。"
						title="メディアソースがありません"
					>
						<Button onClick={() => page().handleAddSource()}>Add Source</Button>
					</EmptyState>
				</Match>
				<Match when={props.state().phase === "data"}>
					<div class="grid min-w-0 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
						<For each={props.mediaSources()}>
							{(source) => props.renderSourceCard(source)}
						</For>
					</div>
				</Match>
			</Switch>

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
