import { createSignal, Match, Show, Switch } from "solid-js";
import {
	EmptyState,
	ErrorState,
	OfflineState,
	QueryStatus,
	RetryButton,
} from "../async-state";
import { Button } from "../button";
import type { UseManagerPageResult } from "../hooks/use-manager-page";
import { V2ManagementHeader } from "../v2/management-layout";
import { BatchToolPanel } from "./v2-manager/batch-tools";
import { DataTransferPanel } from "./v2-manager/data-transfer";
import { ManagerDialogs } from "./v2-manager/dialogs";
import { DuplicateToolPanel } from "./v2-manager/duplicates";
import {
	EntityTablePanel,
	ManagerTableSkeleton,
} from "./v2-manager/entity-panel";
import { ManagerCategoryNavigation } from "./v2-manager/navigation";
import { ThumbnailWarmupPanel } from "./v2-manager/thumbnail";
import type {
	V2ManagerCategory,
	V2ManagerTransferActions,
} from "./v2-manager/types";
import {
	categoryLabel,
	isCrudCategory,
	singularLabel,
} from "./v2-manager/utils";

export type {
	V2ManagerTransferActions,
	V2ManagerTransferFormat,
} from "./v2-manager/types";

export function V2ManagerScreen(props: {
	manager: UseManagerPageResult;
	transferActions?: V2ManagerTransferActions;
}) {
	const [query, setQuery] = createSignal("");
	const [selectedId, setSelectedId] = createSignal<string | null>(null);
	const [activeCategory, setActiveCategory] =
		createSignal<V2ManagerCategory>("projects");
	const activeQueryState = () => {
		const states = props.manager.queryStates();
		switch (activeCategory()) {
			case "projects":
				return states.projects;
			case "ips":
				return states.ips;
			case "characters":
				return states.characters;
			default:
				return states.sources;
		}
	};
	const canRenderContent = () =>
		activeQueryState().phase === "data" ||
		(activeQueryState().phase === "empty" && !isCrudCategory(activeCategory()));
	const changeCategory = (value: V2ManagerCategory) => {
		setQuery("");
		setSelectedId(null);
		setActiveCategory(value);
		if (value !== "transfer") props.manager.setActiveTab(value);
	};

	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-[var(--v2-canvas)]">
			<V2ManagementHeader
				description="分類データの管理とバッチ処理の投入を行います。"
				title="Manager"
			/>

			<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-gutter:stable]">
				<ManagerCategoryNavigation
					active={activeCategory()}
					compact
					onChange={changeCategory}
				/>
				<div class="grid w-full gap-6 px-3 py-4 sm:px-4 lg:grid-cols-[12rem_minmax(0,1fr)] lg:px-6 lg:py-5 xl:gap-8 xl:px-8">
					<ManagerCategoryNavigation
						active={activeCategory()}
						onChange={changeCategory}
					/>

					<div class="min-w-0">
						<QueryStatus
							class="mb-3"
							fetchState={activeQueryState().fetchState}
							hasData={activeQueryState().data !== undefined}
							hideWhenIdle
							offlineLabel="オフラインのため保存済みの管理データを表示しています。"
							updatingLabel="管理データを更新中..."
						/>

						<Switch>
							<Match when={activeQueryState().phase === "pending"}>
								<ManagerTableSkeleton />
							</Match>
							<Match when={activeQueryState().phase === "error"}>
								<ErrorState
									description="接続を確認して、もう一度お試しください。"
									onRetry={props.manager.retryQueries}
									title="管理データを取得できませんでした"
								/>
							</Match>
							<Match when={activeQueryState().phase === "offline"}>
								<OfflineState
									description="接続が戻ったら、この画面から再試行できます。"
									onRetry={props.manager.retryQueries}
								/>
							</Match>
						</Switch>

						<Show
							when={
								activeQueryState().phase === "empty" &&
								isCrudCategory(activeCategory())
							}
						>
							<EmptyState
								description="最初の項目を作成すると、ここに表示されます。"
								title={`${categoryLabel(activeCategory())}はまだありません`}
							>
								<Button onClick={props.manager.openCreateDialog}>
									New {singularLabel(props.manager.activeTab())}
								</Button>
							</EmptyState>
						</Show>

						<Show when={canRenderContent()}>
							<Switch>
								<Match when={isCrudCategory(activeCategory())}>
									<Show
										when={
											props.manager.activeTab() !== "characters" ||
											(props.manager.queryStates().ips.phase !== "error" &&
												props.manager.queryStates().ips.phase !== "offline")
										}
									>
										<EntityTablePanel
											manager={props.manager}
											onQueryChange={setQuery}
											onSelect={setSelectedId}
											query={query()}
											selectedId={selectedId()}
										/>
									</Show>
									<Show
										when={
											props.manager.activeTab() === "characters" &&
											(props.manager.queryStates().ips.phase === "error" ||
												props.manager.queryStates().ips.phase === "offline")
										}
									>
										<div class="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-md border border-warning-foreground/30 bg-warning/40 p-3">
											<p class="text-xs text-[var(--v2-text-secondary)]">
												IP候補を取得できませんでした。Characters一覧は引き続き利用できます。
											</p>
											<RetryButton
												class="h-8 px-3 text-xs"
												label="IP候補を再取得"
												onRetry={props.manager.retryQueries}
											/>
										</div>
										<EntityTablePanel
											manager={props.manager}
											onQueryChange={setQuery}
											onSelect={setSelectedId}
											query={query()}
											selectedId={selectedId()}
										/>
									</Show>
								</Match>
								<Match when={activeCategory() === "tagging"}>
									<BatchToolPanel kind="tagging" manager={props.manager} />
								</Match>
								<Match when={activeCategory() === "vectors"}>
									<BatchToolPanel kind="vectors" manager={props.manager} />
								</Match>
								<Match when={activeCategory() === "thumbnails"}>
									<ThumbnailWarmupPanel manager={props.manager} />
								</Match>
								<Match when={activeCategory() === "duplicates"}>
									<DuplicateToolPanel manager={props.manager} />
								</Match>
								<Match when={activeCategory() === "transfer"}>
									<Show
										fallback={
											<ErrorState
												description="Data transfer actions are not configured for this client."
												title="Data transfer is unavailable"
											/>
										}
										when={props.transferActions}
									>
										{(actions) => (
											<DataTransferPanel
												actions={actions()}
												manager={props.manager}
											/>
										)}
									</Show>
								</Match>
							</Switch>
						</Show>
					</div>
				</div>
			</div>

			<ManagerDialogs manager={props.manager} />
		</section>
	);
}
