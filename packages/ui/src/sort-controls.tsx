import { t } from "@solid-imager/i18n";
import { getSearchExecutionKind } from "./search-execution";
import { Show } from "solid-js";
import { Button } from "./button";
import { Input } from "./input";
import { Label } from "./label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { parseSelectValue } from "./utils/parse-select-value";

import { getSortLabel, SORT_OPTIONS, type SortOption } from "./sort-options";

type SortControlsProps = {
	sortBy: SortOption;
	sortOrder: "asc" | "desc";
	onSortByChange: (value: SortOption) => void;
	onSortOrderChange: (value: "asc" | "desc") => void;
	similarityAnchorMediaId?: string | null;
	semanticQuery?: string;
	similarityTopK?: number;
	onSimilarityTopKChange?: (value: number) => void;
	onClearSimilarity?: () => void;
	similarityLimitId?: string;
	className?: string;
};

export function SortControls(props: SortControlsProps) {
	return (
		<div class={props.className}>
			<div class="space-y-2">
				<Label>{t("sortControls.sort")}</Label>
				<div class="flex gap-2">
					<Select
						disabled={getSearchExecutionKind(props) !== "ordinary"}
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{getSortLabel(
									parseSelectValue(
										itemProps.item.rawValue,
										SORT_OPTIONS,
										"date",
									),
								)}
							</SelectItem>
						)}
						onChange={(value) =>
							props.onSortByChange(
								parseSelectValue(value, SORT_OPTIONS, "date"),
							)
						}
						options={[...SORT_OPTIONS]}
						placeholder={t("sortControls.field")}
						value={props.sortBy}
					>
						<SelectTrigger class="min-w-0 flex-1 gap-2 whitespace-nowrap text-left">
							<SelectValue<string>>
								{(state) =>
									getSortLabel(
										parseSelectValue(
											state.selectedOption(),
											SORT_OPTIONS,
											"date",
										),
									)
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
					<Select
						disabled={getSearchExecutionKind(props) !== "ordinary"}
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{itemProps.item.rawValue === "asc"
									? t("searchToolbar.ascending")
									: t("searchToolbar.descending")}
							</SelectItem>
						)}
						onChange={(value) => props.onSortOrderChange(value || "desc")}
						options={["asc", "desc"]}
						placeholder={t("sortControls.order")}
						value={props.sortOrder}
					>
						<SelectTrigger class="w-20 shrink-0 gap-2 whitespace-nowrap text-left">
							<SelectValue<string>>
								{(state) =>
									state.selectedOption() === "asc"
										? t("searchToolbar.ascending")
										: t("searchToolbar.descending")
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>
			</div>
			<Show
				when={
					getSearchExecutionKind(props) !== "ordinary" &&
					props.similarityTopK !== undefined &&
					props.onSimilarityTopKChange
				}
			>
				<div class="mt-4 space-y-2 border-border border-t pt-4">
					<div class="flex items-center justify-between gap-2">
						<Label for={props.similarityLimitId ?? "similarity-limit"}>
							{getSearchExecutionKind(props) === "semantic"
								? t("sortControls.textSearch")
								: t("sortControls.similarity")}
						</Label>
						<Show when={props.onClearSimilarity}>
							<Button
								class="h-7 px-2 text-xs"
								onClick={props.onClearSimilarity}
								size="sm"
								variant="ghost"
							>
								{t("actions.clear")}
							</Button>
						</Show>
					</div>
					<p class="truncate text-muted-foreground text-xs">
						{getSearchExecutionKind(props) === "semantic"
							? t("sortControls.searchTextValue", {
									value0: String(props.semanticQuery),
								})
							: t("sortControls.referenceMediaValue", {
									value0: String(props.similarityAnchorMediaId),
								})}
					</p>
					<div class="flex items-center gap-2">
						<Input
							aria-describedby={`${props.similarityLimitId ?? "similarity-limit"}-help`}
							class="min-h-9"
							id={props.similarityLimitId ?? "similarity-limit"}
							inputmode="numeric"
							min={1}
							name={props.similarityLimitId ?? "similarity-limit"}
							onInput={(event) => {
								const value = Number(event.currentTarget.value);
								if (Number.isSafeInteger(value) && value >= 1) {
									props.onSimilarityTopKChange?.(value);
								}
							}}
							step={1}
							type="number"
							value={props.similarityTopK}
						/>
						<span class="text-muted-foreground text-xs">
							{t("charts.items")}
						</span>
					</div>
					<p
						class="text-muted-foreground text-xs"
						id={`${props.similarityLimitId ?? "similarity-limit"}-help`}
					>
						{t("sortControls.enterAnIntegerOf1OrGreater")}
					</p>
				</div>
			</Show>
		</div>
	);
}
