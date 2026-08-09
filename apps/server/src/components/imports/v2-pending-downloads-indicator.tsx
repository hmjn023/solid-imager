import { V2PendingDownloadsIndicator as SharedV2PendingDownloadsIndicator } from "@solid-imager/ui/v2-pending-downloads-indicator";
import { pendingDownloadsIndicatorProps } from "./pending-downloads-indicator-data";

export function V2PendingDownloadsIndicator(props: { compact?: boolean }) {
	return (
		<SharedV2PendingDownloadsIndicator
			{...pendingDownloadsIndicatorProps}
			compact={props.compact}
		/>
	);
}
