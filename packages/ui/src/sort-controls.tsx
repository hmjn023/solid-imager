import { Label } from "./label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";

export type SortOption = "date" | "name" | "size" | "rating" | "viewCount";

type SortControlsProps = {
	sortBy: SortOption;
	sortOrder: "asc" | "desc";
	onSortByChange: (value: SortOption) => void;
	onSortOrderChange: (value: "asc" | "desc") => void;
	className?: string;
};

function getSortLabel(value: SortOption) {
	if (value === "date") {
		return "作成日";
	}
	if (value === "name") {
		return "ファイル名";
	}
	if (value === "size") {
		return "サイズ";
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
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{getSortLabel(itemProps.item.rawValue as SortOption)}
							</SelectItem>
						)}
						onChange={(value) =>
							props.onSortByChange((value as SortOption) || "date")
						}
						options={["date", "name", "size", "rating", "viewCount"]}
						placeholder="項目"
						value={props.sortBy}
					>
						<SelectTrigger>
							<SelectValue<string>>
								{(state) =>
									getSortLabel((state.selectedOption() as SortOption) || "date")
								}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
					<Select
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
		</div>
	);
}
