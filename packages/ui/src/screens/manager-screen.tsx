import { t } from "@solid-imager/i18n";
import { ServerBatchStatus } from "./manager/job-status";
import { AuthorManagementPanel } from "./manager/authors";
import type { AuthorManagementActions } from "./manager/authors.types";
import { createEffect, createSignal, Match, on, Show, Switch } from "solid-js";
import {
	EmptyState,
	ErrorState,
	OfflineState,
	QueryStatus,
	RetryButton,
} from "../async-state";
import { Button } from "../button";
import type { UseManagerPageResult } from "../hooks/use-manager-page";
import { ManagementHeader } from "../workspace/management-layout";
import { BatchToolPanel } from "./manager/batch-tools";
import { DataTransferPanel } from "./manager/data-transfer";
import { ManagerDialogs } from "./manager/dialogs";
import { DuplicateToolPanel } from "./manager/duplicates";
import { EntityTablePanel, ManagerTableSkeleton } from "./manager/entity-panel";
import { ManagerCategoryNavigation } from "./manager/navigation";
import { ThumbnailWarmupPanel } from "./manager/thumbnail";
import {
	CharacterClusteringReviewPanel,
	type CharacterClusteringReviewActions,
} from "./manager/character-clustering";
import type {
	ManagerCategoryValue,
	ManagerTransferActions,
} from "./manager/types";
import { categoryLabel, isCrudCategory, singularLabel } from "./manager/utils";

export type {
	ManagerTransferActions,
	ManagerTransferFormat,
} from "./manager/types";

/** Renders the selected management tool and shows active server batches, including runs started by other clients. */
export function ManagerScreen(props: {
	manager: UseManagerPageResult;
	transferActions?: ManagerTransferActions;
	authorActions?: AuthorManagementActions;
	clusteringActions?: CharacterClusteringReviewActions;
}) {
	const [query, setQuery] = createSignal("");
	const [selectedId, setSelectedId] = createSignal<string | null>(null);
	const [activeCategory, setActiveCategory] =
		createSignal<ManagerCategoryValue>(
			(() => {
				try {
					return typeof sessionStorage !== "undefined" &&
						sessionStorage.getItem("solid-imager:manager:clustering-open") ===
							"1"
						? "clustering"
						: "projects";
				} catch {
					return "projects";
				}
			})(),
		);
	createEffect(
		on(
			() => props.manager.activeTab(),
			(tab, previous) => {
				if (previous !== undefined || tab !== "projects")
					setActiveCategory(tab);
			},
		),
	);
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
	const changeCategory = (value: ManagerCategoryValue) => {
		setQuery("");
		setSelectedId(null);
		setActiveCategory(value);
		try {
			if (typeof sessionStorage !== "undefined")
				sessionStorage.setItem(
					"solid-imager:manager:clustering-open",
					value === "clustering" ? "1" : "0",
				);
		} catch {
			/* Storage can be disabled. */
		}
		if (value !== "transfer" && value !== "authors" && value !== "clustering")
			props.manager.setActiveTab(value);
	};

	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-background">
			<ManagementHeader
				description={t(
					"managerScreen.manageClassificationDataAndSubmitBatchJobs",
				)}
				title={t("navigation.manager")}
			/>

			<div
				class="min-h-0 flex-1 overflow-y-auto overscroll-contain scrollbar-stable"
				data-clustering-scroll
			>
				<ManagerCategoryNavigation
					active={activeCategory()}
					compact
					onChange={changeCategory}
				/>
				<div class="grid w-full gap-6 px-3 py-4 sm:px-4 lg:grid-cols-settings-sidebar lg:px-6 lg:py-5 xl:gap-8 xl:px-8">
					<ManagerCategoryNavigation
						active={activeCategory()}
						onChange={changeCategory}
					/>

					<div class="min-w-0">
						<Show when={props.manager.activeBatchesFailed()}>
							<ErrorState
								title={t("managerScreen.couldNotLoadActiveBatches")}
								onRetry={props.manager.retryActiveBatches}
							/>
						</Show>
						<ServerBatchStatus
							manager={props.manager}
							jobs={props.manager
								.activeBatches()
								.filter(
									(job) =>
										job.id !== props.manager.displayedJobId() ||
										!["thumbnails", "vectors", "tagging"].includes(
											activeCategory(),
										),
								)}
						/>
						<Show when={activeCategory() === "authors"}>
							<Show
								when={props.authorActions}
								fallback={
									<ErrorState
										title={t("managerScreen.authorManagementIsUnavailable")}
									/>
								}
							>
								{(actions) => (
									<AuthorManagementPanel
										actions={actions()}
										sources={props.manager
											.sources()
											.flatMap((source) =>
												source.id ? [{ id: source.id, name: source.name }] : [],
											)}
									/>
								)}
							</Show>
						</Show>
						<Show when={activeCategory() === "clustering"}>
							<Show
								when={props.clusteringActions}
								fallback={
									<ErrorState
										title={t("managerScreen.clusteringResultsAreUnavailable")}
									/>
								}
							>
								{(actions) => (
									<CharacterClusteringReviewPanel actions={actions()} />
								)}
							</Show>
						</Show>
						<Show
							when={
								activeCategory() !== "authors" &&
								activeCategory() !== "clustering"
							}
						>
							<QueryStatus
								class="mb-3"
								fetchState={activeQueryState().fetchState}
								hasData={activeQueryState().data !== undefined}
								hideWhenIdle
								offlineLabel={t(
									"managerScreen.offlineShowingSavedManagementData",
								)}
								updatingLabel={t("managerScreen.updatingManagementData")}
							/>

							<Switch>
								<Match when={activeQueryState().phase === "pending"}>
									<ManagerTableSkeleton />
								</Match>
								<Match when={activeQueryState().phase === "error"}>
									<ErrorState
										description={t("jobsScreen.checkYourConnectionAndTryAgain")}
										onRetry={props.manager.retryQueries}
										title={t("managerScreen.couldNotLoadManagementData")}
									/>
								</Match>
								<Match when={activeQueryState().phase === "offline"}>
									<OfflineState
										description={t(
											"managerScreen.retryHereWhenYourConnectionReturns",
										)}
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
									description={t(
										"managerScreen.createYourFirstItemToSeeItHere",
									)}
									title={t("managerScreen.noValueYet", {
										value0: String(categoryLabel(activeCategory())),
									})}
								>
									<Button onClick={props.manager.openCreateDialog}>
										{t("entityPanel.newValue", {
											value0: String(singularLabel(props.manager.activeTab())),
										})}
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
												<p class="text-xs text-muted-foreground">
													{t(
														"managerScreen.couldNotLoadIPOptionsYouCanStillUse",
													)}
												</p>
												<RetryButton
													class="h-8 px-3 text-xs"
													label={t("managerScreen.reloadIPOptions")}
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
													description={t(
														"managerScreen.dataTransferActionsAreNotConfiguredForThisClient",
													)}
													title={t("managerScreen.dataTransferIsUnavailable")}
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
						</Show>
					</div>
				</div>
			</div>

			<ManagerDialogs manager={props.manager} />
		</section>
	);
}
