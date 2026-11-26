import { t } from "@solid-imager/i18n";
import { Show } from "solid-js";
import { Button } from "../button";
import { observePageBoundary } from "../hooks/observe-page-boundary";

export function ViewerLoadBoundary(props: {
	direction: "previous" | "next";
	root: () => HTMLDivElement | undefined;
	autoLoad: boolean;
	onlyFillViewport?: boolean;
	loading: boolean;
	failed: boolean;
	onLoad: () => Promise<unknown>;
}) {
	let boundary: HTMLDivElement | undefined;
	observePageBoundary({
		target: () => boundary,
		root: props.root,
		enabled: () => props.autoLoad && !props.loading && !props.failed,
		rootMargin: () =>
			props.direction === "next" && !props.onlyFillViewport
				? "0px 0px 240px"
				: "0px",
		load: () => {
			if (!props.onlyFillViewport) return props.onLoad();
			const root = props.root();
			if (!root || !boundary) return;
			const remainingHeight =
				root.getBoundingClientRect().bottom -
				boundary.getBoundingClientRect().bottom;
			// A full first page can fit on a wide display without being short.
			if (remainingHeight >= root.clientHeight / 4) return props.onLoad();
		},
	});
	return (
		<div
			ref={(element) => {
				boundary = element;
			}}
			class="flex min-h-11 flex-wrap items-center justify-center gap-2 py-2 text-sm text-muted-foreground"
		>
			<Show when={props.failed}>
				<p role="alert">{t("loadBoundary.couldNotLoadMorePosts")}</p>
			</Show>
			<Button
				type="button"
				size="sm"
				variant="ghost"
				class="min-h-11 sm:min-h-9"
				aria-busy={props.loading ? "true" : "false"}
				disabled={props.loading}
				onClick={() => void props.onLoad()}
			>
				{props.loading
					? t("status.loading")
					: props.failed
						? t("actions.retry")
						: props.direction === "next"
							? t("actions.loadMore")
							: t("loadBoundary.loadPreviousPosts")}
			</Button>
		</div>
	);
}
