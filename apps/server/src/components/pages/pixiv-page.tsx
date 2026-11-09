import { createClient } from "@solid-imager/client";
import type { AppContract } from "@solid-imager/core/contract";
import { useRouter } from "@tanstack/solid-router";
import { ExternalViewerRoute } from "@solid-imager/ui/external-viewer";
import { client } from "~/infrastructure/api-clients/orpc-client";
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
			apiBase={() => window.location.origin}
		/>
	);
}
