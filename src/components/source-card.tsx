import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import type { MediaSourceInfo } from "~/domain/sources/types";

type SourceCardProps = {
	mediaSource: MediaSourceInfo;
	onEdit?: (source: MediaSourceInfo) => void;
	onDelete?: (source: MediaSourceInfo) => void;
};

export default function SourceCard(props: SourceCardProps) {
	return (
		<Card class="relative" data-testid="source-card">
			<CardHeader>
				<CardTitle data-testid="source-name">
					{props.mediaSource.name}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<CardDescription>{props.mediaSource.description}</CardDescription>
				<p>Type: {props.mediaSource.type}</p>
				{/* HACK: connectionInfoはパスを持つオブジェクトである保証はありません */}
				<p>
					Path:{" "}
					{typeof props.mediaSource.connectionInfo === "object" &&
					props.mediaSource.connectionInfo !== null &&
					"path" in props.mediaSource.connectionInfo
						? String(props.mediaSource.connectionInfo.path)
						: "N/A"}
				</p>
			</CardContent>
			{/* 編集ボタンと削除ボタン */}
			<div class="absolute top-2 right-2 z-10 flex gap-1">
				{props.onEdit && (
					<button
						class="rounded border bg-white px-2 py-1 text-xs shadow hover:bg-gray-50"
						data-testid="edit-source-btn"
						onClick={() => props.onEdit?.(props.mediaSource)}
						type="button"
					>
						Edit
					</button>
				)}
				{props.onDelete && (
					<button
						class="rounded bg-red-500 px-2 py-1 text-white text-xs shadow hover:bg-red-600"
						data-testid="delete-source-btn"
						onClick={() => props.onDelete?.(props.mediaSource)}
						type="button"
					>
						Delete
					</button>
				)}
			</div>
		</Card>
	);
}
