import { t } from "@solid-imager/i18n";
import {
	defaultState,
	type SearchState,
	searchStateSchema,
} from "@solid-imager/core/search";
import { deepEqual } from "@solid-imager/core/utils";
import { createSignal, For, Show } from "solid-js";
import { createStore } from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import {
	SearchControlPanel,
	type SearchControlPanelProps,
} from "./search-control-panel";
import { searchState, setSearchState } from "./stores/search-store";

export type MobileSearchFilterDialogProps = Omit<
	SearchControlPanelProps,
	"setState" | "showSearchButton" | "state"
> & {
	open: boolean;
	onOpenChange: (open: boolean) => void;
};

function copySearchState(state: SearchState): SearchState {
	return searchStateSchema.parse(state);
}

function createClearedSearchState(state: SearchState): SearchState {
	return {
		...defaultState,
		mode: state.mode,
		selectedSource: state.selectedSource,
		sortBy: state.sortBy,
		sortOrder: state.sortOrder,
		tagMode: state.tagMode,
	};
}

function getActiveConditionLabels(
	props: Pick<MobileSearchFilterDialogProps, "context" | "sources">,
	state: SearchState,
) {
	const labels: string[] = [];

	if (props.context === "global" && state.selectedSource) {
		const source = props.sources?.find(
			(item) => item.id === state.selectedSource,
		);
		labels.push(
			t("mediaSidebar.sourceValue", {
				value0: String(source?.name ?? t("contextMenu.selected")),
			}),
		);
	}
	if (state.similarityAnchorMediaId) {
		labels.push(
			t("mobileSearchFilterDialog.similarityValueResults", {
				value0: String(state.similarityTopK),
			}),
		);
	}
	if (state.semanticQuery) {
		labels.push(
			t("mobileSearchFilterDialog.textSearchValue", {
				value0: String(state.semanticQuery),
			}),
		);
		return labels;
	}

	if (state.mode === "simple") {
		if (state.searchQuery.trim()) {
			labels.push(
				t("mobileSearchFilterDialog.filenameValue", {
					value0: String(state.searchQuery.trim()),
				}),
			);
		}
		if (state.selectedTags.length > 0) {
			labels.push(
				t("mobileSearchFilterDialog.tagsValue", {
					value0: String(state.selectedTags.length),
				}),
			);
		}
		if (state.excludeTags.length > 0) {
			labels.push(
				t("mobileSearchFilterDialog.excludedTagsValue", {
					value0: String(state.excludeTags.length),
				}),
			);
		}
		if (state.selectedProjects.length > 0) {
			labels.push(
				t("mobileSearchFilterDialog.projectsValue", {
					value0: String(state.selectedProjects.length),
				}),
			);
		}
		if (state.selectedIps.length > 0) {
			labels.push(
				t("mobileSearchFilterDialog.iPsValue", {
					value0: String(state.selectedIps.length),
				}),
			);
		}
		if (state.selectedCharacters.length > 0) {
			labels.push(
				t("mobileSearchFilterDialog.charactersValue", {
					value0: String(state.selectedCharacters.length),
				}),
			);
		}
		if (state.selectedAuthors.length > 0) {
			labels.push(
				t("mobileSearchFilterDialog.authorsValue", {
					value0: String(state.selectedAuthors.length),
				}),
			);
		}
		return labels;
	}

	if (state.mode === "pro") {
		if (state.advancedCondition) {
			labels.push(t("mobileSearchFilterDialog.advancedConditionsConfigured"));
		}
		return labels;
	}

	return labels;
}

function CurrentSearchConditions(props: {
	context: MobileSearchFilterDialogProps["context"];
	sources: MobileSearchFilterDialogProps["sources"];
	state: SearchState;
}) {
	const labels = () => getActiveConditionLabels(props, props.state);

	return (
		<div
			aria-atomic="true"
			aria-live="polite"
			class="rounded-md border bg-muted/40 p-3 text-sm"
			data-testid="current-search-conditions"
		>
			<div class="flex items-center justify-between gap-3">
				<span class="font-medium">
					{t("mobileSearchFilterDialog.currentConditions")}
				</span>
				<span class="text-muted-foreground text-xs">
					{labels().length > 0
						? t("charts.valueItems", { value0: String(labels().length) })
						: t("mobileSearchFilterDialog.notSpecified")}
				</span>
			</div>
			<Show
				fallback={
					<p class="mt-2 text-muted-foreground">
						{t("mobileSearchFilterDialog.noConditionsSpecified")}
					</p>
				}
				when={labels().length > 0}
			>
				<ul class="mt-2 flex flex-wrap gap-1.5">
					<For each={labels()}>
						{(label) => (
							<li class="max-w-full break-words rounded-full bg-background px-2 py-1 text-xs">
								{label}
							</li>
						)}
					</For>
				</ul>
			</Show>
		</div>
	);
}

export function MobileSearchFilterDialog(props: MobileSearchFilterDialogProps) {
	const currentSearchState = () =>
		copySearchState({
			...searchState,
			selectedSource: props.selectedSource ?? searchState.selectedSource,
		});
	const [baseline, setBaseline] =
		createSignal<SearchState>(currentSearchState());
	const [draft, setDraft] = createStore<SearchState>(currentSearchState());
	const [confirmDiscard, setConfirmDiscard] = createSignal(false);
	let commitSemanticDraft: (() => boolean) | undefined;
	let wasOpen = false;

	createTrackedEffect(() => {
		if (props.open && !wasOpen) {
			const snapshot = currentSearchState();
			setBaseline(snapshot);
			setDraft(() => snapshot);
			setConfirmDiscard(false);
		}
		wasOpen = props.open;
	});

	const isDirty = () => !deepEqual(copySearchState(draft), baseline());
	const requestClose = () => {
		if (isDirty()) {
			setConfirmDiscard(true);
			return;
		}
		props.onOpenChange(false);
	};

	const handleApply = () => {
		commitSemanticDraft?.();
		const nextState = copySearchState(draft);
		setSearchState(() => nextState);
		props.onSelectSource?.(nextState.selectedSource);
		props.onOpenChange(false);
		queueMicrotask(() => props.onSearch());
	};
	const handleClear = () => {
		setDraft(createClearedSearchState);
	};
	return (
		<>
			<Dialog
				onOpenChange={(next) =>
					next ? props.onOpenChange(true) : requestClose()
				}
				open={props.open}
			>
				<DialogContent class="max-w-lg gap-4 p-4 sm:p-6">
					<DialogHeader>
						<DialogTitle>{t("searchToolbar.searchFilters")}</DialogTitle>
						<DialogDescription>
							{t(
								"mobileSearchFilterDialog.reviewOrEditConditionsBeforeApplyingThemToThe",
							)}
						</DialogDescription>
					</DialogHeader>
					<CurrentSearchConditions
						context={props.context}
						sources={props.sources}
						state={draft}
					/>
					<div class="min-w-0 space-y-4">
						<SearchControlPanel
							context={props.context}
							filterData={props.filterData}
							onSearch={handleApply}
							presetClient={props.presetClient}
							registerSemanticCommit={(commit) => {
								commitSemanticDraft = commit;
							}}
							selectedSource={draft.selectedSource}
							setState={setDraft}
							showSearchButton={false}
							sources={props.sources}
							state={draft}
							usePopover={props.usePopover}
						/>
					</div>
					<DialogFooter class="border-t pt-4">
						<Button
							class="min-h-11 sm:min-h-9"
							onClick={handleClear}
							type="button"
							variant="outline"
						>
							{t("mobileSearchFilterDialog.clearConditions")}
						</Button>
						<Button
							class="min-h-11 sm:min-h-9"
							onClick={requestClose}
							type="button"
							variant="outline"
						>
							{t("actions.cancel")}
						</Button>
						<Button
							class="min-h-11 sm:min-h-9"
							onClick={handleApply}
							type="button"
						>
							{t("actions.apply")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				onOpenChange={setConfirmDiscard}
				open={props.open && confirmDiscard()}
			>
				<AlertDialogContent class="workspace-theme rounded-lg sm:max-w-dialog-xs">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("mobileSearchFilterDialog.discardChangesTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("mobileSearchFilterDialog.discardChangesDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel class="min-h-11 sm:min-h-9">
							{t("configScreen.keepEditing")}
						</AlertDialogCancel>
						<AlertDialogAction
							class="min-h-11 sm:min-h-9"
							onClick={() => {
								setConfirmDiscard(false);
								props.onOpenChange(false);
							}}
							variant="destructive"
						>
							{t("actions.discard")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}

import { createTrackedEffect } from "solid-js";
