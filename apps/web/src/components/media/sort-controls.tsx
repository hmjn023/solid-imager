import { Label } from "~/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "~/components/ui/select";
import { cn } from "~/presentation/utils/cn";

type SortOption = "date" | "name" | "size" | "rating" | "viewCount";

type SortControlsProps = {
	sortBy: SortOption;
	sortOrder: "asc" | "desc";
	onSortByChange: (value: SortOption) => void;
	onSortOrderChange: (value: "asc" | "desc") => void;
	className?: string;
};

export function SortControls(props: SortControlsProps) {
	return (
		<div class={cn("space-y-2", props.className)}>
			<Label>ソート</Label>
			<div class="grid grid-cols-2 gap-2">
				<Select
					itemComponent={(itemProps) => {
						const getSortLabel = (value: string) => {
							if (value === "date") {
								return "作成日";
							}
							if (value === "name") {
								return "ファイル名";
							}
							if (value === "rating") {
								return "評価";
							}
							if (value === "viewCount") {
								return "閲覧数";
							}
							return "サイズ";
						};
						return (
							<SelectItem item={itemProps.item}>
								{getSortLabel(itemProps.item.rawValue)}
							</SelectItem>
						);
					}}
					onChange={(value) =>
						props.onSortByChange((value as SortOption) || "date")
					}
					options={["date", "name", "size", "rating", "viewCount"]}
					placeholder="項目"
					value={props.sortBy}
				>
					<SelectTrigger>
						<SelectValue<string>>
							{(state) => {
								const value = state.selectedOption();
								if (value === "date") {
									return "作成日";
								}
								if (value === "name") {
									return "ファイル名";
								}
								if (value === "rating") {
									return "評価";
								}
								if (value === "viewCount") {
									return "閲覧数";
								}
								return "サイズ";
							}}
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
							{(state) => (state.selectedOption() === "asc" ? "昇順" : "降順")}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
			</div>
		</div>
	);
}
