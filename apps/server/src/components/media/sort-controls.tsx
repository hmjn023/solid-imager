import { t } from "@solid-imager/i18n";
import { Label } from "@solid-imager/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import {
	getSortLabel,
	SORT_OPTIONS,
	type SortOption,
} from "@solid-imager/ui/sort-options";
import { parseSelectValue, cn } from "@solid-imager/ui/utils";

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
			<Label>{t("sortControls.sort")}</Label>
			<div class="grid grid-cols-2 gap-2">
				<Select
					itemComponent={(itemProps) => {
						return (
							<SelectItem item={itemProps.item}>
								{getSortLabel(
									parseSelectValue(
										itemProps.item.rawValue,
										SORT_OPTIONS,
										"date",
									),
								)}
							</SelectItem>
						);
					}}
					onChange={(value) =>
						props.onSortByChange(parseSelectValue(value, SORT_OPTIONS, "date"))
					}
					options={[...SORT_OPTIONS]}
					placeholder={t("sortControls.field")}
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
					<SelectTrigger>
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
	);
}
