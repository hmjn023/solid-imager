import { t } from "@solid-imager/i18n";
import {
	defaultState,
	type SearchState,
	searchStateSchema,
} from "@solid-imager/core/search";
import { createEffect, For, Show } from "solid-js";
import { createStore } from "solid-js/store";
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
	const [draft, setDraft] = createStore<SearchState>(currentSearchState());
	let wasOpen = false;

	createEffect(() => {
		if (props.open && !wasOpen) {
			setDraft(currentSearchState());
		}
		wasOpen = props.open;
	});

	const handleApply = () => {
		const nextState = copySearchState(draft);
		setSearchState(nextState);
		props.onSelectSource?.(nextState.selectedSource);
		props.onOpenChange(false);
		props.onSearch();
	};
	const handleClear = () => {
		setDraft(createClearedSearchState(draft));
	};
	return (
		<Dialog onOpenChange={props.onOpenChange} open={props.open}>
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
						selectedSource={draft.selectedSource}
						setState={setDraft}
						showSearchButton={false}
						sources={props.sources}
						state={draft}
						usePopover={props.usePopover}
					/>
				</div>
				<DialogFooter class="border-t pt-4">
					<Button onClick={handleClear} type="button" variant="outline">
						{t("mobileSearchFilterDialog.clearConditions")}
					</Button>
					<Button onClick={handleApply} type="button">
						{t("actions.apply")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
