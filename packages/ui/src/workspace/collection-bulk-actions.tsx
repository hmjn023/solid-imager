import { t } from "@solid-imager/i18n";
import { Show } from "solid-js";
import { Button } from "../button";

export function CollectionBulkActions(props: {
	loadedCount: number;
	selectedCount: number;
	testId: string;
	onSelectAll?: () => void;
	onBulkAction?: () => void;
	onClearSelection?: () => void;
}) {
	return (
		<div
			class="flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-border bg-card px-3 py-2 sm:gap-3 sm:px-4"
			data-testid={props.testId}
		>
			<output class="w-full text-center font-medium text-sm sm:w-auto">
				{t("searchScreen.valueSelected", {
					value0: String(props.selectedCount),
				})}
			</output>
			<Show when={props.onSelectAll}>
				<Button
					class="min-h-11 sm:min-h-9"
					disabled={
						props.loadedCount === 0 || props.selectedCount === props.loadedCount
					}
					onClick={props.onSelectAll}
					size="sm"
					variant="outline"
				>
					{t("searchScreen.selectAllLoadedItems")}
				</Button>
			</Show>
			<Show when={props.onBulkAction}>
				<Button
					class="min-h-11 sm:min-h-9"
					disabled={props.selectedCount === 0}
					onClick={props.onBulkAction}
					size="sm"
				>
					{t("searchScreen.runBulkAction")}
				</Button>
			</Show>
			<Show when={props.onClearSelection}>
				<Button
					class="min-h-11 sm:min-h-9"
					onClick={props.onClearSelection}
					size="sm"
					variant="outline"
				>
					{t("actions.clearSelection")}
				</Button>
			</Show>
		</div>
	);
}
