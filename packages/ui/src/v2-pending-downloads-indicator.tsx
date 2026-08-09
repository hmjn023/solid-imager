import { Show } from "solid-js";
import type { PendingDownloadsIndicatorProps } from "./pending-downloads-indicator.types";
import { PendingDownloadsIndicatorCore } from "./pending-downloads-indicator-core";
import { cn } from "./utils/cn";
import { V2ImportReviewModal } from "./v2-import-review-modal";

export type V2PendingDownloadsIndicatorProps =
	PendingDownloadsIndicatorProps & {
		compact?: boolean;
	};

export function V2PendingDownloadsIndicator(
	props: V2PendingDownloadsIndicatorProps,
) {
	return (
		<PendingDownloadsIndicatorCore
			{...props}
			renderButton={({ onOpen, pendingCount }) => {
				const hasPendingImports = () => (pendingCount() ?? 0) > 0;
				return (
					<button
						aria-disabled={!hasPendingImports()}
						aria-label={`Import inbox${hasPendingImports() ? `, ${pendingCount()}件` : ""}`}
						class={cn(
							"relative flex h-10 w-full items-center justify-start gap-2 rounded-md px-3 font-medium text-[var(--v2-text-secondary)] text-xs transition-colors hover:bg-[var(--v2-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-auto disabled:opacity-60",
							props.compact && "size-10 justify-center px-0",
						)}
						disabled={!hasPendingImports()}
						onClick={onOpen}
						type="button"
					>
						<span aria-hidden="true" class="text-base leading-none">
							↓
						</span>
						<span class={props.compact ? "sr-only" : undefined}>
							Import inbox
						</span>
						<Show when={hasPendingImports()}>
							<span
								class={cn(
									"ml-auto rounded-full bg-[var(--v2-surface-selected)] px-1.5 py-0.5 text-[10px] text-[var(--v2-primary)]",
									props.compact && "absolute -mt-5 ml-5",
								)}
							>
								{pendingCount()}
							</span>
						</Show>
					</button>
				);
			}}
			renderFallback={() => (
				<button
					class="h-10 w-full cursor-default rounded bg-transparent font-bold text-[var(--v2-text-muted)] text-xs"
					disabled
					type="button"
				>
					Inbox
				</button>
			)}
			renderModal={(modalProps) => (
				<V2ImportReviewModal
					{...modalProps}
					cancelPending={props.cancelPending}
					listPending={props.listPending}
					listSources={props.listSources}
					processPending={props.processPending}
				/>
			)}
		/>
	);
}
