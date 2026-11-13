import { t } from "@solid-imager/i18n";
import { Button } from "./button";

type PaginationControlsProps = {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	class?: string;
};

export function PaginationControls(props: PaginationControlsProps) {
	return (
		<div class={`flex items-center gap-2 ${props.class || ""}`}>
			<Button
				disabled={props.currentPage === 1}
				onClick={() => props.onPageChange(Math.max(1, props.currentPage - 1))}
				size="sm"
				variant="outline"
			>
				{t("actions.previous")}
			</Button>
			<span class="flex items-center px-2 text-sm">
				{t("paginationControls.pageValueOfValue", {
					value0: String(props.currentPage),
					value1: String(props.totalPages),
				})}
			</span>
			<Button
				disabled={props.currentPage === props.totalPages}
				onClick={() =>
					props.onPageChange(Math.min(props.totalPages, props.currentPage + 1))
				}
				size="sm"
				variant="outline"
			>
				{t("actions.next")}
			</Button>
		</div>
	);
}
