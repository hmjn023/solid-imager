import { createFileRoute, Link, useParams } from "@tanstack/solid-router";
import { RoutePlaceholder } from "../../../../components/route-placeholder";

export const Route = createFileRoute("/sources/$mediaSourceId/$mediaId/")({
	component: MediaDetailRoute,
});

function MediaDetailRoute() {
	const params = useParams({ from: "/sources/$mediaSourceId/$mediaId/" });

	return (
		<RoutePlaceholder
			actions={
				<Link
					class="text-sky-600 hover:underline"
					params={{ mediaSourceId: params().mediaSourceId }}
					to="/sources/$mediaSourceId"
				>
					Back to source
				</Link>
			}
			description={`Media ${params().mediaId} の詳細 UI をここへ移植します。メタデータ表示と編集操作は Tauri API client を介して接続します。`}
			title="Media Detail"
		/>
	);
}
