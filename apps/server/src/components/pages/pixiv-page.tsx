import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";
import { useRouter } from "@tanstack/solid-router";
import { ExternalViewerRoute } from "@solid-imager/ui/external-viewer";
import { client, getApiOrigin } from "~/infrastructure/api-clients/orpc-client";
import { subscribeImportEvents } from "../imports/pending-downloads-indicator-data";
export function PixivPage() {
	const { history } = useRouter();
	return (
		<ExternalViewerRoute
			history={history}
			provider="pixiv"
			createViewer={(url, fetch) =>
				createClient<AppContract>({ url, fetch }).viewer
			}
			client={client}
			apiBase={getApiOrigin}
			subscribeImportEvents={subscribeImportEvents}
		/>
	);
}
