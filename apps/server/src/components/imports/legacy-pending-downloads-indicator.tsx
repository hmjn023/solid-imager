import { PendingDownloadsIndicator as SharedPendingDownloadsIndicator } from "@solid-imager/ui/legacy-pending-downloads-indicator";
import { pendingDownloadsIndicatorProps } from "./pending-downloads-indicator-data";

export function PendingDownloadsIndicator() {
	return (
		<SharedPendingDownloadsIndicator {...pendingDownloadsIndicatorProps} />
	);
}
