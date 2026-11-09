import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";
import { ExternalViewerRoute } from "@solid-imager/ui/external-viewer";
import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { client, fetchServer } from "~/orpc-client";
import { getApiBaseUrl } from "~/infrastructure/api-base";
export const Route = createFileRoute("/pixiv")({
	component: PixivPage,
});

function PixivPage() {
	const { history } = useRouter();
	return (
		<ExternalViewerRoute
			history={history}
			provider="pixiv"
			createViewer={(url, fetch) =>
				createClient<AppContract>({ url, fetch }).viewer
			}
			client={client}
			apiBase={getApiBaseUrl}
			fetch={fetchServer}
		/>
	);
}
