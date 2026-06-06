import { AppNav } from "@solid-imager/ui/layouts/app-nav";
import PendingDownloadsIndicator from "./imports/pending-downloads-indicator";

export default function Nav() {
	return <AppNav pendingDownloadsIndicator={<PendingDownloadsIndicator />} />;
}
