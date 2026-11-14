import { t } from "@solid-imager/i18n";
import {
	Pagination,
	PaginationEllipsis,
	PaginationItem,
	PaginationItems,
	PaginationNext,
	PaginationPrevious,
} from "./pagination";
import { cn } from "./utils/cn";

type PaginationControlsProps = {
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
	class?: string;
};

export function PaginationControls(props: PaginationControlsProps) {
	const totalPages = () => Math.max(1, props.totalPages);
	const currentPage = () =>
		Math.min(Math.max(1, props.currentPage), totalPages());

	return (
		<div class={cn("flex flex-wrap items-center gap-2", props.class)}>
			<Pagination
				class="[&>*]:flex-wrap [&>ul>li:not(:first-child):not(:last-child)]:hidden sm:[&>ul>li:not(:first-child):not(:last-child)]:block"
				count={totalPages()}
				ellipsisComponent={() => <PaginationEllipsis />}
				itemComponent={(itemProps) => (
					<PaginationItem page={itemProps.page}>
						{itemProps.page}
					</PaginationItem>
				)}
				onPageChange={props.onPageChange}
				page={currentPage()}
			>
				<PaginationPrevious aria-label={t("actions.previous")} />
				<PaginationItems />
				<PaginationNext aria-label={t("actions.next")} />
			</Pagination>
			<span
				aria-live="polite"
				class="flex items-center px-2 text-muted-foreground text-sm"
			>
				{t("paginationControls.pageValueOfValue", {
					value0: String(props.currentPage),
					value1: String(props.totalPages),
				})}
			</span>
		</div>
	);
}
