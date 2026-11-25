import { useRouter } from "@tanstack/solid-router";
import { ExternalViewerRoute } from "@solid-imager/ui/external-viewer";
import { client, getApiOrigin } from "~/infrastructure/api-clients/orpc-client";
import { subscribeImportEvents } from "../imports/pending-downloads-indicator-data";
export function DanbooruPage() {
	const { history } = useRouter();
	return (
		<ExternalViewerRoute
			history={history}
			provider="danbooru"
			client={client}
			apiBase={getApiOrigin}
			subscribeImportEvents={subscribeImportEvents}
		/>
	);
}
