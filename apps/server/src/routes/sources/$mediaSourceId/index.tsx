import { searchHistoryQuerySchema } from "@solid-imager/ui/search-history-route";
import { createFileRoute } from "@tanstack/solid-router";
import { V2SourceMediaPage } from "./components/media-source-page";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	validateSearch: searchHistoryQuerySchema,
	ssr: false,
	pendingComponent: () => null,
	remountDeps: ({ params }: { params: { mediaSourceId: string } }) => [
		params.mediaSourceId,
	],
	component: SourceMediaRoute,
});

function SourceMediaRoute() {
	const params = Route.useParams();
	return <V2SourceMediaPage mediaSourceId={() => params().mediaSourceId} />;
}
