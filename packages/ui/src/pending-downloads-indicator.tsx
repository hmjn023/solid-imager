import { Show } from "solid-js";
import { ImportReviewModal } from "./import-review-modal";
import type { PendingDownloadsIndicatorProps } from "./pending-downloads-indicator.types";
import { PendingDownloadsIndicatorCore } from "./pending-downloads-indicator-core";

export type {
	ImportEventConnectedHandler,
	ImportEventHandler,
	PendingDownloadsIndicatorProps,
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
						class={`flex items-center gap-1 rounded px-3 py-1.5 font-bold text-xs transition-colors ${
							hasPendingImports()
								? "bg-sky-600 text-white hover:bg-sky-500"
								: "cursor-default bg-gray-700 text-gray-400"
						}`}
						onClick={() => {
							if (hasPendingImports()) onOpen();
						}}
						type="button"
					>
						<span>Inbox</span>
						<Show when={hasPendingImports()}>
							<span class="rounded bg-white px-1.5 py-0.5 text-sky-700">
								{pendingCount()}
							</span>
						</Show>
					</button>
				);
			}}
			renderFallback={() => (
				<button
					class="cursor-default rounded bg-gray-700 px-3 py-1.5 font-bold text-gray-400 text-xs"
					disabled
					type="button"
				>
					Inbox
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
