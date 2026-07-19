import {
	defaultState,
	type SearchState,
	searchStateSchema,
} from "@solid-imager/core/domain/search/schema";
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
		// A cleared vector search has no valid anchor, so return to a mode that
		// can be applied instead of leaving the dialog permanently disabled.
		mode: state.mode === "vector" ? "simple" : state.mode,
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
		labels.push(`ソース: ${source?.name ?? "選択済み"}`);
	}

	if (state.mode === "simple") {
		if (state.searchQuery.trim()) {
			labels.push(`ファイル名: ${state.searchQuery.trim()}`);
		}
		if (state.selectedTags.length > 0) {
			labels.push(`タグ: ${state.selectedTags.length}件`);
		}
		if (state.excludeTags.length > 0) {
			labels.push(`除外タグ: ${state.excludeTags.length}件`);
		}
		if (state.selectedProjects.length > 0) {
			labels.push(`プロジェクト: ${state.selectedProjects.length}件`);
		}
		if (state.selectedIps.length > 0) {
			labels.push(`IP: ${state.selectedIps.length}件`);
		}
		if (state.selectedCharacters.length > 0) {
			labels.push(`キャラクター: ${state.selectedCharacters.length}件`);
		}
		if (state.selectedAuthors.length > 0) {
			labels.push(`作者: ${state.selectedAuthors.length}件`);
		}
		return labels;
	}

	if (state.mode === "pro") {
		if (state.advancedCondition) {
			labels.push("詳細条件を設定済み");
		}
		return labels;
	}

	if (state.similarityAnchorMediaId) {
		labels.push("類似元メディアを設定済み");
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
			aria-live="polite"
			class="rounded-md border bg-muted/40 p-3 text-sm"
			data-testid="current-search-conditions"
			role="status"
		>
			<div class="flex items-center justify-between gap-3">
				<span class="font-medium">現在の条件</span>
				<span class="text-muted-foreground text-xs">
					{labels().length > 0 ? `${labels().length}件` : "指定なし"}
				</span>
			</div>
			<Show
				fallback={
					<p class="mt-2 text-muted-foreground">条件は指定されていません。</p>
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
	const isApplyDisabled = () =>
		draft.mode === "vector" && !draft.similarityAnchorMediaId;

	return (
		<Dialog onOpenChange={props.onOpenChange} open={props.open}>
			<DialogContent class="max-w-lg gap-4 p-4 sm:p-6">
				<DialogHeader>
					<DialogTitle>検索フィルター</DialogTitle>
					<DialogDescription>
						条件を確認・変更してから検索結果へ適用できます。
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
						条件をクリア
					</Button>
					<Button
						disabled={isApplyDisabled()}
						onClick={handleApply}
						type="button"
					>
						適用
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
