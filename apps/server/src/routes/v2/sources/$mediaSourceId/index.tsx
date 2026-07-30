import { createFileRoute } from "@tanstack/solid-router";
import { SourceMediaPage } from "~/routes/sources/$mediaSourceId/components/source-media-page";

export const Route = createFileRoute("/v2/sources/$mediaSourceId/")({
	remountDeps: ({ params }: { params: { mediaSourceId: string } }) => [
		params.mediaSourceId,
	],
	component: V2SourceMediaRoute,
});

function V2SourceMediaRoute() {
	const params = Route.useParams();
	return (
		<SourceMediaPage
			mediaSourceId={() => params().mediaSourceId}
			variant="v2"
		/>
	);
}
