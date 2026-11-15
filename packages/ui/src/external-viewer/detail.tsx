import { t } from "@solid-imager/i18n";
import type { DownloadItem } from "@solid-imager/core/media";
import {
	createSignal,
	type JSX,
	Match,
	onCleanup,
	onMount,
	Show,
	Switch,
} from "solid-js";
import { ErrorState, OfflineState, QueryStatus } from "../async-state";
import { Button, buttonVariants } from "../button";
import { MediaDetailSkeleton } from "../media-detail-skeleton";
import { MediaDetailToolbar } from "../media-detail-layout";
import { toQueryUiState, type QueryStateLike } from "../query-state";
import { LoadingRegion } from "../skeleton";
import { toast } from "../toast";

/** Keep the state of an import with its URL as the viewer moves between posts and pages. */
export function createViewerImports(
	enqueue: (item: DownloadItem) => Promise<unknown>,
) {
	const [targets, setTargets] = createSignal(
		new Map<string, "pending" | "queued">(),
	);
	async function add(item: DownloadItem) {
		const url = item.targetUrl;
		if (!url || targets().has(url)) return;
		setTargets((current) => new Map(current).set(url, "pending"));
		try {
			await enqueue(item);
			setTargets((current) => new Map(current).set(url, "queued"));
			toast.success(t("detail.addedToImportInbox"), {
				description: t("detail.chooseADestinationFromTheSidebarImportInboxTo"),
			});
		} catch (error) {
			setTargets((current) => {
				const next = new Map(current);
				next.delete(url);
				return next;
			});
			toast.error(t("detail.couldNotAddToImportInbox"), {
				description:
					error instanceof Error ? error.message : t("detail.pleaseRetry"),
			});
		}
	}
	return {
		state: (url?: string) => (url ? targets().get(url) : undefined),
		add,
	};
}

type ViewerNavigation = {
	previousId?: number;
	nextId?: number;
	onNavigate: (id: number) => void;
	onBack: () => void;
};

export type ViewerDetailNavigation = ViewerNavigation & { postId: number };

export type ViewerDetailProps<Post> = ViewerDetailNavigation & {
	query: QueryStateLike<Post> & { refetch: () => Promise<unknown> };
	imports: ReturnType<typeof createViewerImports>;
};

export function ViewerToolbar(
	props: ViewerNavigation & {
		provider: "Danbooru" | "pixiv";
		title: string;
		actions?: JSX.Element;
	},
) {
	const navigate = (id?: number) =>
		id === undefined ? undefined : () => props.onNavigate(id);
	const noun = () =>
		props.provider === "pixiv" ? t("detail.work") : t("detail.post");
	return (
		<MediaDetailToolbar
			title={props.title}
			sourceName={props.provider}
			onBack={props.onBack}
			onPrevious={navigate(props.previousId)}
			onNext={navigate(props.nextId)}
			previousLabel={t("detail.previousValue", { value0: String(noun()) })}
			nextLabel={t("detail.nextValue", { value0: String(noun()) })}
			actions={props.actions}
		/>
	);
}

export function ViewerActions(props: {
	item: DownloadItem | null;
	imports: ReturnType<typeof createViewerImports>;
	importLabel: string;
	sourceHref: string;
	sourceLabel: string;
}) {
	const status = () => props.imports.state(props.item?.targetUrl);
	return (
		<div class="flex flex-wrap items-center gap-2">
			<a
				href={props.sourceHref}
				class={buttonVariants({ variant: "outline" })}
				target="_blank"
				rel="noopener noreferrer"
			>
				{props.sourceLabel} ↗
			</a>
			<Button
				disabled={!props.item?.targetUrl || status() !== undefined}
				aria-busy={status() === "pending"}
				onClick={() => props.item && void props.imports.add(props.item)}
			>
				{status() === "queued"
					? t("detail.alreadyInImportInbox")
					: status() === "pending"
						? t("detail.adding")
						: props.importLabel}
			</Button>
		</div>
	);
}

/** Provides a navigable detail route even when a directly linked post is offline or missing. */
export function ViewerDetail<Post extends { id: number }>(
	props: ViewerDetailProps<Post> & {
		provider: "Danbooru" | "pixiv";
		children: (post: Post) => JSX.Element;
	},
) {
	const title = () =>
		t("detail.valueValue", {
			value0: String(props.provider),
			value1: String(props.postId),
		});
	const selected = () => {
		const post =
			props.query.status === "pending" ? undefined : props.query.data;
		return post?.id === props.postId ? post : undefined;
	};
	const state = () =>
		toQueryUiState({
			data: selected(),
			error: props.query.error,
			fetchStatus: props.query.fetchStatus,
			status: props.query.status,
		});
	const retry = async () => {
		await props.query.refetch();
	};
	let region!: HTMLElement;
	onMount(() => {
		region.focus({ preventScroll: true });
		const escape = (event: KeyboardEvent) => {
			if (
				event.key !== "Escape" ||
				event.repeat ||
				event.defaultPrevented ||
				document.fullscreenElement
			)
				return;
			if (
				!(event.target instanceof Node) ||
				(!region.contains(event.target) && event.target !== document.body)
			)
				return;
			if (document.querySelector('[role="dialog"], [role="alertdialog"]'))
				return;
			event.preventDefault();
			props.onBack();
		};
		window.addEventListener("keydown", escape);
		onCleanup(() => window.removeEventListener("keydown", escape));
	});
	return (
		<section
			ref={(el) => {
				region = el;
			}}
			tabindex="-1"
			aria-label={title()}
			class="flex h-full min-h-0 flex-col bg-background text-foreground outline-none"
		>
			<Show when={!selected()}>
				<ViewerToolbar {...props} title={title()} />
			</Show>
			<QueryStatus
				fetchState={state().fetchState}
				hasData={!!selected()}
				hasError={!!state().error}
				hideWhenIdle
				offlineLabel={t("sourceMediaScreen.offlineShowingSavedData")}
				updatingLabel={t("detail.updatingPostDetails")}
			/>
			<Switch>
				<Match when={state().phase === "data"}>
					<Show when={selected()} keyed>
						{props.children}
					</Show>
				</Match>
				<Match when={state().phase === "offline"}>
					<OfflineState onRetry={retry} />
				</Match>
				<Match when={state().phase === "error"}>
					<ErrorState
						title={
							props.provider === "pixiv"
								? t("detail.couldNotLoadTheWork")
								: t("detail.couldNotLoadThePost")
						}
						description={
							props.query.error instanceof Error
								? props.query.error.message
								: undefined
						}
						onRetry={retry}
					/>
				</Match>
				<Match when={state().phase === "pending"}>
					<LoadingRegion
						label={t("mediaDetailScreen.loadingMediaDetails")}
						class="min-h-0 flex-1"
					>
						<MediaDetailSkeleton includeHeader={false} />
					</LoadingRegion>
				</Match>
			</Switch>
		</section>
	);
}
