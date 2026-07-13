import { Match, Show, Switch } from "solid-js";
import {
	CardGridSkeleton,
	CardSkeleton,
	ConfigSkeleton,
	ManagerSkeleton,
	MediaDetailSkeleton,
	MediaGridSkeleton,
	Skeleton,
} from "./skeleton";
import { cn } from "./utils/cn";

export type ScreenSkeletonLayout =
	| "cards"
	| "config"
	| "manager"
	| "media-detail"
	| "media-grid";

export type ScreenSkeletonProps = {
	class?: string;
	description?: string;
	layout: ScreenSkeletonLayout;
	loadingLabel: string;
	showAction?: boolean;
	showDescription?: boolean;
	title: string;
};

/** Static, SSR-safe screen fallback that reserves the main content dimensions. */
export function ScreenSkeleton(props: ScreenSkeletonProps) {
	return (
		<div
			class={cn("container mx-auto p-4", props.class)}
			data-screen-skeleton={props.layout}
			data-state-ui="pending"
		>
			<p class="sr-only" role="status">
				{props.loadingLabel}
			</p>
			<div aria-busy="true">
				<div
					class={cn(
						"flex flex-wrap items-start justify-between gap-4",
						props.layout === "media-detail"
							? "mb-2"
							: props.layout === "manager"
								? "mb-8"
								: "mb-6",
					)}
				>
					<div>
						<h1
							class={cn(
								"font-bold text-3xl",
								props.layout === "media-detail" && "sr-only",
							)}
						>
							{props.title}
						</h1>
						<Show when={props.showDescription && props.description}>
							{(description) => (
								<p
									aria-hidden={description() === props.loadingLabel}
									class={cn(
										"text-muted-foreground",
										props.layout !== "media-detail" && "mt-2",
									)}
								>
									{description()}
								</p>
							)}
						</Show>
					</div>
					<Show when={props.showAction}>
						<Skeleton class="h-10 w-28" />
					</Show>
				</div>
				<Switch>
					<Match when={props.layout === "cards"}>
						<CardGridSkeleton />
					</Match>
					<Match when={props.layout === "manager"}>
						<ManagerSkeleton />
					</Match>
					<Match when={props.layout === "media-grid"}>
						<div class="grid gap-6 md:grid-cols-[300px_1fr]">
							<CardSkeleton class="hidden min-h-96 md:block" />
							<MediaGridSkeleton />
						</div>
					</Match>
					<Match when={props.layout === "media-detail"}>
						<MediaDetailSkeleton />
					</Match>
					<Match when={props.layout === "config"}>
						<ConfigSkeleton />
					</Match>
				</Switch>
			</div>
		</div>
	);
}
