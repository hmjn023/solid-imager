import type {
	MediaSourceInfo,
	SafeMediaSource,
} from "@solid-imager/core/domain/sources/schemas";
import { Link } from "@tanstack/solid-router";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./card";

type SourceCardProps = {
	mediaSource: SafeMediaSource | MediaSourceInfo;
	href?: string;
	onEdit?: (source: SafeMediaSource | MediaSourceInfo) => void;
	onDelete?: (source: SafeMediaSource | MediaSourceInfo) => void;
	onSync?: (source: SafeMediaSource | MediaSourceInfo) => void;
};

const getTypeLabel = (type: string) => {
	switch (type) {
		case "local":
			return "Local Filesystem";
		case "sftp":
			return "SFTP";
		case "s3":
			return "S3 Compatible Storage";
		default:
			return type;
	}
};

const getConnectionDetails = (source: SafeMediaSource | MediaSourceInfo) => {
	const info = source.connectionInfo as Record<string, string>;

	if (source.type === "local") {
		return `Path: ${info.path || "N/A"}`;
	}
	if (source.type === "sftp") {
		return `SFTP: ${info.host || "?"}:${info.remotePath || "?"}`;
	}
	if (source.type === "s3") {
		return `S3: ${info.bucket || "?"} (${info.region || "?"})`;
	}
	return "Unknown Connection";
};

export function SourceCard(props: SourceCardProps) {
	const handleEditClick = (event: MouseEvent) => {
		event.stopPropagation();
		event.preventDefault();
		props.onEdit?.(props.mediaSource);
	};

	const handleSyncClick = (event: MouseEvent) => {
		event.stopPropagation();
		event.preventDefault();
		props.onSync?.(props.mediaSource);
	};

	const handleDeleteClick = (event: MouseEvent) => {
		event.stopPropagation();
		event.preventDefault();
		props.onDelete?.(props.mediaSource);
	};

	const content = () => (
		<>
			<CardHeader class="min-w-0 p-4 sm:p-6">
				<CardTitle class="break-words" data-testid="source-name">
					{props.mediaSource.name}
				</CardTitle>
			</CardHeader>
			<CardContent class="min-w-0 p-4 pt-0 sm:p-6 sm:pt-0">
				<CardDescription class="break-words">
					{props.mediaSource.description}
				</CardDescription>
				<div class="mt-4 space-y-2 text-sm">
					<p>
						<span class="font-semibold">Type:</span>{" "}
						{getTypeLabel(props.mediaSource.type)}
					</p>
					<p class="truncate" title={getConnectionDetails(props.mediaSource)}>
						{getConnectionDetails(props.mediaSource)}
					</p>
				</div>
			</CardContent>
		</>
	);

	const sourceLink = () => {
		if (props.href) {
			return (
				<a class="block min-w-0 text-current no-underline" href={props.href}>
					{content()}
				</a>
			);
		}

		if (!props.mediaSource.id) {
			return (
				<Link class="block min-w-0 text-current no-underline" to="/sources">
					{content()}
				</Link>
			);
		}

		return (
			<Link
				class="block min-w-0 text-current no-underline"
				params={{ mediaSourceId: props.mediaSource.id }}
				to="/sources/$mediaSourceId"
			>
				{content()}
			</Link>
		);
	};

	return (
		<Card
			class="h-full overflow-hidden hover:bg-gray-50"
			data-testid="source-card"
		>
			{sourceLink()}
			{(props.onSync || props.onEdit || props.onDelete) && (
				<div class="flex flex-wrap gap-2 border-t bg-muted/30 p-3">
					{props.onSync && (
						<button
							class="min-h-11 min-w-0 flex-1 rounded border bg-background px-3 font-medium text-sm shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							data-testid="sync-source-btn"
							onClick={handleSyncClick}
							type="button"
						>
							Sync
						</button>
					)}
					{props.onEdit && (
						<button
							class="min-h-11 min-w-0 flex-1 rounded border bg-background px-3 font-medium text-sm shadow-sm hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							data-testid="edit-source-btn"
							onClick={handleEditClick}
							type="button"
						>
							Edit
						</button>
					)}
					{props.onDelete && (
						<button
							class="min-h-11 min-w-0 flex-1 rounded bg-red-500 px-3 font-medium text-sm text-white shadow-sm hover:bg-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2"
							data-testid="delete-source-btn"
							onClick={handleDeleteClick}
							type="button"
						>
							Delete
						</button>
					)}
				</div>
			)}
		</Card>
	);
}
