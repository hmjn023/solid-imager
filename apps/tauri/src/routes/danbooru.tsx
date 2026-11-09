import { ExternalViewerRoute } from "@solid-imager/ui/external-viewer";
import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { client } from "~/infrastructure/api-clients/orpc-client";
import { getApiBaseUrl } from "~/infrastructure/api-base";
export const Route = createFileRoute("/danbooru")({
	component: DanbooruPage,
});

function DanbooruPage() {
	const { history } = useRouter();
	return (
		<ExternalViewerRoute
			history={history}
			provider="danbooru"
			client={client}
			apiBase={getApiBaseUrl}
		/>
	);
}
