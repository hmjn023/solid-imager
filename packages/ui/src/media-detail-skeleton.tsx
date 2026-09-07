import { Skeleton } from "./skeleton";
import { cn } from "./utils/cn";

export type V2MediaDetailSkeletonProps = {
	class?: string;
};

export function V2MediaDetailSkeleton(props: V2MediaDetailSkeletonProps) {
	return (
		<div
			aria-hidden="true"
			class={cn("flex h-full min-h-0 flex-col", props.class)}
			data-skeleton="media-detail"
		>
			<div class="flex min-h-14 shrink-0 items-center gap-3 border-b px-4">
				<Skeleton class="size-9" />
				<div class="min-w-0 flex-1 space-y-2">
					<Skeleton class="h-4 w-56 max-w-full" />
					<Skeleton class="h-3 w-32 max-w-full" />
				</div>
				<Skeleton class="h-9 w-28" />
			</div>
			<div class="min-h-0 flex-1 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem]">
				<div class="flex min-h-[55dvh] items-center justify-center p-4 lg:min-h-0">
					<Skeleton class="h-full max-h-full w-full rounded-none" />
				</div>
				<div class="space-y-4 border-t p-4 lg:border-t-0 lg:border-l">
					<Skeleton class="h-6 w-2/3" />
					<Skeleton class="h-20 w-full" />
					<Skeleton class="h-28 w-full" />
					<Skeleton class="h-10 w-full" />
				</div>
			</div>
		</div>
	);
}
