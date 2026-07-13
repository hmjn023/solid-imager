import type { ComponentProps, ParentProps } from "solid-js";
import { For, splitProps } from "solid-js";
import { Card, CardContent, CardHeader } from "./card";
import { cn } from "./utils/cn";

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
	class?: string;
	count?: number;
};

export function MediaGridSkeleton(props: MediaGridSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			class={cn(
				"grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5",
				props.class,
			)}
			data-skeleton="media-grid"
		>
			<For each={Array.from({ length: props.count ?? 10 })}>
				{() => <Skeleton class="aspect-[3/4] w-full rounded-lg" />}
			</For>
		</div>
	);
}

export type MediaDetailSkeletonProps = {
	class?: string;
};

export function MediaDetailSkeleton(props: MediaDetailSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			class={cn(
				"flex min-h-[calc(100dvh-5rem)] flex-col gap-4 lg:flex-row",
				props.class,
			)}
			data-skeleton="media-detail"
		>
			<Skeleton class="min-h-80 flex-1 rounded-lg lg:min-h-0" />
			<div class="w-full shrink-0 space-y-4 rounded-lg border p-4 lg:w-96">
				<Skeleton class="h-7 w-3/4" />
				<Skeleton class="h-4 w-1/2" />
				<Skeleton class="h-24 w-full" />
				<Skeleton class="h-10 w-full" />
				<Skeleton class="h-10 w-full" />
			</div>
		</div>
	);
}

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
