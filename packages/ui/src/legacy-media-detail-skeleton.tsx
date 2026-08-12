import { Skeleton } from "./skeleton";
import { cn } from "./utils/cn";

export type LegacyMediaDetailSkeletonProps = {
	class?: string;
};

export function LegacyMediaDetailSkeleton(
	props: LegacyMediaDetailSkeletonProps,
) {
	return (
		<div
			aria-hidden="true"
			class={cn(
				"flex min-h-[calc(100dvh-7.5rem)] flex-col gap-4 lg:flex-row",
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
