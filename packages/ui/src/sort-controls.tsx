import type { MediaSort } from "@solid-imager/core/domain/media/schemas";
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

export const SORT_OPTIONS = [
	"date",
	"modifiedAt",
	"indexedAt",
	"size",
	"resolution",
	"name",
	"rating",
	"viewCount",
] as const satisfies readonly MediaSort[];

export type SortOption = (typeof SORT_OPTIONS)[number];

type SortControlsProps = {
	sortBy: SortOption;
	sortOrder: "asc" | "desc";
	onSortByChange: (value: SortOption) => void;
	onSortOrderChange: (value: "asc" | "desc") => void;
	similarityAnchorMediaId?: string | null;
	similarityTopK?: number;
	onSimilarityTopKChange?: (value: number) => void;
	onClearSimilarity?: () => void;
	similarityLimitId?: string;
	className?: string;
};

export function getSortLabel(value: SortOption) {
	if (value === "date") {
		return "ファイル作成日時";
	}
	if (value === "modifiedAt") {
		return "更新日時";
	}
	if (value === "indexedAt") {
		return "登録日時";
	}
	if (value === "name") {
		return "名前";
	}
	if (value === "size") {
		return "ファイルサイズ";
	}
	if (value === "resolution") {
		return "解像度";
	}
	if (value === "rating") {
		return "評価";
	}
	return "閲覧数";
}

export function SortControls(props: SortControlsProps) {
	return (
		<div class={props.className}>
			<div class="space-y-2">
				<Label>ソート</Label>
				<div class="grid grid-cols-2 gap-2">
					<Select
						disabled={Boolean(props.similarityAnchorMediaId)}
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
						placeholder="項目"
						value={props.sortBy}
					>
						<SelectTrigger>
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
						disabled={Boolean(props.similarityAnchorMediaId)}
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{itemProps.item.rawValue === "asc" ? "昇順" : "降順"}
							</SelectItem>
						)}
						onChange={(value) => props.onSortOrderChange(value || "desc")}
						options={["asc", "desc"]}
						placeholder="順序"
						value={props.sortOrder}
					>
						<SelectTrigger>
							<SelectValue<string>>
								{(state) =>
									state.selectedOption() === "asc" ? "昇順" : "降順"
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>
			</div>
			<Show
				when={
					props.similarityAnchorMediaId &&
					props.similarityTopK !== undefined &&
					props.onSimilarityTopKChange
				}
			>
				<div class="mt-4 space-y-2 border-border border-t pt-4">
					<div class="flex items-center justify-between gap-2">
						<Label for={props.similarityLimitId ?? "similarity-limit"}>
							類似度順
						</Label>
						<Show when={props.onClearSimilarity}>
							<Button
								class="h-7 px-2 text-xs"
								onClick={props.onClearSimilarity}
								size="sm"
								variant="ghost"
							>
								解除
							</Button>
						</Show>
					</div>
					<p class="truncate text-muted-foreground text-xs">
						類似元: {props.similarityAnchorMediaId}
					</p>
					<div class="flex items-center gap-2">
						<Input
							aria-describedby={`${props.similarityLimitId ?? "similarity-limit"}-help`}
							class="min-h-9"
							id={props.similarityLimitId ?? "similarity-limit"}
							inputmode="numeric"
							max={100}
							min={1}
							name={props.similarityLimitId ?? "similarity-limit"}
							onInput={(event) => {
								const value = Number(event.currentTarget.value);
								if (Number.isInteger(value) && value >= 1 && value <= 100) {
									props.onSimilarityTopKChange?.(value);
								}
							}}
							step={1}
							type="number"
							value={props.similarityTopK}
						/>
						<span class="text-muted-foreground text-xs">件</span>
					</div>
					<p
						class="text-muted-foreground text-xs"
						id={`${props.similarityLimitId ?? "similarity-limit"}-help`}
					>
						1〜100の整数を指定できます。
					</p>
				</div>
			</Show>
		</div>
	);
}
