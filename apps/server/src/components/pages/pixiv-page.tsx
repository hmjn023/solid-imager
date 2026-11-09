import { useRouter } from "@tanstack/solid-router";
import { ExternalViewerRoute } from "@solid-imager/ui/external-viewer";
import { client } from "~/infrastructure/api-clients/orpc-client";
export function PixivPage() {
	const { history } = useRouter();
	return (
		<ExternalViewerRoute
			history={history}
			provider="pixiv"
			client={client}
			apiBase={() => window.location.origin}
		/>
	);
}
