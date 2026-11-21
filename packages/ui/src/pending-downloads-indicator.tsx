import { t } from "@solid-imager/i18n";
import { Show } from "solid-js";
import { ImportReviewModal } from "./import-review-modal";
import type { PendingDownloadsIndicatorProps as PendingDownloadsIndicatorBaseProps } from "./pending-downloads-indicator.types";
import { PendingDownloadsIndicatorCore } from "./pending-downloads-indicator-core";
import { cn } from "./utils/cn";

export type PendingDownloadsIndicatorProps =
	PendingDownloadsIndicatorBaseProps & {
		compact?: boolean;
	};

export type {
	ImportEventConnectedHandler,
	ImportEventHandler,
} from "./pending-downloads-indicator.types";

export function PendingDownloadsIndicator(
	props: PendingDownloadsIndicatorProps,
) {
	return (
		<PendingDownloadsIndicatorCore
			{...props}
			renderButton={({ onOpen, pendingCount }) => {
				const hasPendingImports = () => (pendingCount() ?? 0) > 0;
				return (
					<button
						aria-disabled={!hasPendingImports()}
						aria-label={t("pendingDownloadsIndicator.importInboxValue", {
							value0: String(
								hasPendingImports()
									? t("pendingDownloadsIndicator.valueItems", {
											value0: String(pendingCount()),
										})
									: "",
							),
						})}
						class={cn(
							"relative flex h-11 w-full items-center justify-start gap-2 rounded-md px-3 font-medium text-muted-foreground text-xs transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-auto disabled:opacity-60 md:h-10",
							props.compact && "mx-auto size-11 justify-center px-0 md:size-10",
						)}
						disabled={!hasPendingImports()}
						onClick={onOpen}
						type="button"
					>
						<span aria-hidden="true" class="text-base leading-none">
							↓
						</span>
						<span class={props.compact ? "sr-only" : undefined}>
							{t("navigation.importInbox")}
						</span>
						<Show when={hasPendingImports()}>
							<span
								class={cn(
									"ml-auto rounded-full bg-accent px-1.5 py-0.5 text-label-xs text-primary",
									props.compact && "absolute top-0.5 right-0.5 m-0",
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
					aria-label={t("navigation.importInbox")}
					class={cn(
						"flex h-11 w-full cursor-default items-center justify-start gap-2 rounded-md bg-transparent px-3 font-medium text-muted-foreground text-xs opacity-60 md:h-10",
						props.compact && "mx-auto size-11 justify-center px-0 md:size-10",
					)}
					disabled
					type="button"
				>
					<span aria-hidden="true" class="text-base leading-none">
						↓
					</span>
					<span class={props.compact ? "sr-only" : undefined}>
						{t("navigation.importInbox")}
					</span>
				</button>
			)}
			renderModal={(modalProps) => (
				<ImportReviewModal
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
