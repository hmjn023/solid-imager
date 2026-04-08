import { createFileRoute, Link, useParams } from "@tanstack/solid-router";
import { RoutePlaceholder } from "../../../components/route-placeholder";

export const Route = createFileRoute("/sources/$mediaSourceId/")({
	component: SourceDetailRoute,
});

function SourceDetailRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/" });

	return (
		<RoutePlaceholder
			actions={
				<Link class="text-sky-600 hover:underline" to="/sources">
					Back to sources
				</Link>
			}
			description={`Source ${params().mediaSourceId} の一覧・フィルタ UI をここへ移植します。server 側 route の検索・ページング処理は次の実装で引き継ぎます。`}
			title="Source Media"
		/>
	);
}
