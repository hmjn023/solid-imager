import { Show } from "solid-js";
import { Button } from "../button";
import { observePageBoundary } from "../hooks/observe-page-boundary";

export function ViewerLoadBoundary(props: {
	direction: "previous" | "next";
	root: () => HTMLDivElement | undefined;
	autoLoad: boolean;
	loading: boolean;
	failed: boolean;
	onLoad: () => Promise<unknown>;
}) {
	let boundary: HTMLDivElement | undefined;
	observePageBoundary({
		target: () => boundary,
		root: props.root,
		enabled: () => props.autoLoad && !props.loading && !props.failed,
		rootMargin: props.direction === "next" ? "0px 0px 240px" : "0px",
		load: props.onLoad,
	});
	return (
		<div
			ref={boundary}
			class="flex min-h-11 flex-wrap items-center justify-center gap-2 py-2 text-sm text-muted-foreground"
		>
			<Show when={props.failed}>
				<p role="alert">投稿を追加で読み込めませんでした。</p>
			</Show>
			<Button
				type="button"
				size="sm"
				variant="ghost"
				class="min-h-11 sm:min-h-9"
				aria-busy={props.loading}
				disabled={props.loading}
				onClick={() => void props.onLoad()}
			>
				{props.loading
					? "読み込み中..."
					: props.failed
						? "再試行"
						: props.direction === "next"
							? "さらに読み込む"
							: "前の投稿を読み込む"}
			</Button>
		</div>
	);
}
