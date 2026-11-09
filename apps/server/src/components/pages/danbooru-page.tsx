import { useRouter } from "@tanstack/solid-router";
import { ExternalViewerRoute } from "@solid-imager/ui/external-viewer";
import { client } from "~/infrastructure/api-clients/orpc-client";
export function DanbooruPage() {
	const { history } = useRouter();
	return (
		<ExternalViewerRoute
			history={history}
			provider="danbooru"
			client={client}
			apiBase={() => window.location.origin}
		/>
	);
}
