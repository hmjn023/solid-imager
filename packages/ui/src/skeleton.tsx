import type { ComponentProps, ParentProps } from "solid-js";
import { For, splitProps } from "solid-js";
import { Card, CardContent, CardHeader } from "./card";
import { cn } from "./utils/cn";

export const mediaGridClassName =
	"grid grid-cols-2 gap-3 @[30rem]:grid-cols-3 @[40rem]:grid-cols-4 @[50rem]:grid-cols-5 @[60rem]:grid-cols-6 @[65rem]:grid-cols-7 @[70rem]:grid-cols-8";

export function getMediaGridColumnCount(width: number): number {
	if (width >= 1120) return 8;
	if (width >= 1040) return 7;
	if (width >= 960) return 6;
	if (width >= 800) return 5;
	if (width >= 640) return 4;
	if (width >= 480) return 3;
	return 2;
}

export type SkeletonProps = Omit<ComponentProps<"div">, "aria-hidden">;

/** Decorative placeholder. Announce loading once on the containing region. */
export function Skeleton(props: SkeletonProps) {
	const [local, others] = splitProps(props, ["class"]);

	return (
		<div
			aria-hidden="true"
			class={cn(
				"animate-pulse rounded-md bg-muted motion-reduce:animate-none",
				local.class,
			)}
			{...others}
		/>
	);
}

export type LoadingRegionProps = ParentProps<{
	class?: string;
	label: string;
}>;

/** Owns the single loading announcement for a group of decorative skeletons. */
export function LoadingRegion(props: LoadingRegionProps) {
	return (
		<>
			<p class="sr-only" role="status">
				{props.label}
			</p>
			<section aria-busy="true" class={props.class} data-state-ui="pending">
				{props.children}
			</section>
		</>
	);
}

export type CardSkeletonProps = {
	class?: string;
};

export function CardSkeleton(props: CardSkeletonProps) {
	return (
		<Card class={cn("min-h-44", props.class)} aria-hidden="true">
			<CardHeader class="space-y-3">
				<Skeleton class="h-5 w-2/3" />
				<Skeleton class="h-4 w-5/6" />
			</CardHeader>
			<CardContent class="space-y-2">
				<Skeleton class="h-4 w-1/2" />
				<Skeleton class="h-4 w-3/4" />
			</CardContent>
		</Card>
	);
}

export type CardGridSkeletonProps = {
	class?: string;
	count?: number;
};

export function CardGridSkeleton(props: CardGridSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			class={cn("grid gap-4 md:grid-cols-2 lg:grid-cols-3", props.class)}
			data-skeleton="card-grid"
		>
			<For each={Array.from({ length: props.count ?? 6 })}>
				{() => <CardSkeleton />}
			</For>
		</div>
	);
}

export type ListSkeletonProps = {
	class?: string;
	count?: number;
};

export function ListSkeleton(props: ListSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			class={cn("space-y-4", props.class)}
			data-skeleton="list"
		>
			<For each={Array.from({ length: props.count ?? 5 })}>
				{() => (
					<div class="space-y-2">
						<Skeleton class="h-4 w-1/3" />
						<Skeleton class="h-10 w-full" />
					</div>
				)}
			</For>
		</div>
	);
}

export type MediaGridSkeletonProps = {
	aspectRatio?: "3/4" | "4/3";
	class?: string;
	count?: number;
};

export function MediaGridSkeleton(props: MediaGridSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			class="@container w-full"
			data-skeleton="media-grid"
		>
			<div class={cn(mediaGridClassName, props.class)}>
				<For each={Array.from({ length: props.count ?? 32 })}>
					{() => (
						<Skeleton
							class={cn(
								"media-grid-skeleton-item w-full",
								props.aspectRatio ? "rounded-md" : "rounded-lg",
								props.aspectRatio === "4/3" ? "aspect-[4/3]" : "aspect-[3/4]",
							)}
						/>
					)}
				</For>
			</div>
		</div>
	);
}

/** Legacy compatibility export. New screens should import an explicit surface. */
export { LegacyMediaDetailSkeleton as MediaDetailSkeleton } from "./legacy-media-detail-skeleton";

export type ConfigSkeletonProps = {
	class?: string;
};

export type ManagerSkeletonProps = {
	class?: string;
};

export function ManagerSkeleton(props: ManagerSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			class={cn("space-y-6", props.class)}
			data-skeleton="manager"
		>
			<div class="flex gap-4 overflow-hidden border-b">
				<For each={Array.from({ length: 6 })}>
					{() => <Skeleton class="h-10 w-24 shrink-0 rounded-none" />}
				</For>
			</div>
			<div class="min-h-6" />
			<CardGridSkeleton />
		</div>
	);
}

export function ConfigSkeleton(props: ConfigSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			class={cn("space-y-6", props.class)}
			data-skeleton="config"
		>
			<div class="grid h-10 grid-cols-6 gap-1">
				<For each={Array.from({ length: 6 })}>
					{() => <Skeleton class="h-10 w-full" />}
				</For>
			</div>
			<div class="space-y-5 rounded-md border p-4">
				<Skeleton class="h-7 w-1/3" />
				<ListSkeleton count={4} />
			</div>
		</div>
	);
}
