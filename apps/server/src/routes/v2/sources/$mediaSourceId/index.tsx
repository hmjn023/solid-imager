import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { createFileRoute } from "@tanstack/solid-router";
import { V2SourceMediaPage } from "~/routes/sources/$mediaSourceId/components/v2-source-media-page";

export const Route = createFileRoute("/v2/sources/$mediaSourceId/")({
	validateSearch: searchHistoryQuerySchema,
	ssr: false,
	pendingComponent: () => null,
	remountDeps: ({ params }: { params: { mediaSourceId: string } }) => [
		params.mediaSourceId,
	],
	component: V2SourceMediaRoute,
});

function V2SourceMediaRoute() {
	const params = Route.useParams();
	return <V2SourceMediaPage mediaSourceId={() => params().mediaSourceId} />;
}
