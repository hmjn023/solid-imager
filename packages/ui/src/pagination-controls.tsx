import { Button } from "./button";

type PaginationControlsProps = {
	currentPage: number;
	onPageChange: (page: number) => void;
	disabled?: boolean;
	label?: string;
	class?: string;
} & (
	| { totalPages: number; hasNextPage?: never }
	| { hasNextPage: boolean; totalPages?: never }
);

export function PaginationControls(props: PaginationControlsProps) {
	const hasNextPage = () =>
		props.totalPages !== undefined
			? props.currentPage < props.totalPages
			: props.hasNextPage;
	return (
		<nav
			aria-label={props.label ?? "ページ切り替え"}
			class={`flex items-center gap-2 ${props.class ?? ""}`}
		>
			<Button
				disabled={props.disabled || props.currentPage <= 1}
				onClick={() => props.onPageChange(props.currentPage - 1)}
				class="min-h-11 sm:min-h-9"
				size="sm"
				variant="outline"
			>
				前のページ
			</Button>
			<span class="flex items-center px-2 text-sm" aria-current="page">
				{props.currentPage}
				{props.totalPages !== undefined && ` / ${props.totalPages}`}
			</span>
			<Button
				disabled={props.disabled || !hasNextPage()}
				onClick={() => props.onPageChange(props.currentPage + 1)}
				class="min-h-11 sm:min-h-9"
				size="sm"
				variant="outline"
			>
				次のページ
			</Button>
		</nav>
	);
}
