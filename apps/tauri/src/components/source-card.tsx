import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { Link } from "@tanstack/solid-router";
import type { MockConnectionInfo, MockSource } from "../mocks/demo-data";

type SourceCardProps = {
	mediaSource: MockSource;
	onDelete?: (source: MockSource) => void;
	onEdit?: (source: MockSource) => void;
	onSync?: (source: MockSource) => void;
};

const getTypeLabel = (type: MockSource["type"]) => {
	switch (type) {
		case "local":
			return "Local Filesystem";
		case "sftp":
			return "SFTP";
		case "s3":
			return "S3 Compatible Storage";
	}
};

const getConnectionDetails = (source: MockSource) => {
	if (isLocalConnection(source.connectionInfo)) {
		return `Path: ${source.connectionInfo.path}`;
	}
	if (isSftpConnection(source.connectionInfo)) {
		return `SFTP: ${source.connectionInfo.host}:${source.connectionInfo.remotePath}`;
	}
	return `S3: ${source.connectionInfo.bucket} (${source.connectionInfo.region})`;
};

function isLocalConnection(
	connectionInfo: MockConnectionInfo,
): connectionInfo is Extract<MockConnectionInfo, { path: string }> {
	return "path" in connectionInfo;
}

function isSftpConnection(
	connectionInfo: MockConnectionInfo,
): connectionInfo is Extract<
	MockConnectionInfo,
	{ host: string; port: number; remotePath: string; username: string }
> {
	return "host" in connectionInfo;
}

export function SourceCard(props: SourceCardProps) {
	const handleEditClick = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		props.onEdit?.(props.mediaSource);
	};

	const handleSyncClick = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		props.onSync?.(props.mediaSource);
	};

	const handleDeleteClick = (event: MouseEvent) => {
		event.preventDefault();
		event.stopPropagation();
		props.onDelete?.(props.mediaSource);
	};

	return (
		<Link
			class="block text-current no-underline"
			params={{ mediaSourceId: props.mediaSource.id }}
			to="/sources/$mediaSourceId"
		>
			<Card class="relative h-full hover:bg-gray-50" data-testid="source-card">
				<CardHeader>
					<CardTitle data-testid="source-name">
						{props.mediaSource.name}
					</CardTitle>
				</CardHeader>
				<CardContent>
					<CardDescription>{props.mediaSource.description}</CardDescription>
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
				<div class="absolute top-2 right-2 z-10 flex gap-1">
					{props.onSync ? (
						<button
							class="rounded border bg-white px-2 py-1 text-xs shadow hover:bg-gray-50"
							onClick={handleSyncClick}
							type="button"
						>
							Sync
						</button>
					) : null}
					{props.onEdit ? (
						<button
							class="rounded border bg-white px-2 py-1 text-xs shadow hover:bg-gray-50"
							onClick={handleEditClick}
							type="button"
						>
							Edit
						</button>
					) : null}
					{props.onDelete ? (
						<button
							class="rounded bg-red-500 px-2 py-1 text-white text-xs shadow hover:bg-red-600"
							onClick={handleDeleteClick}
							type="button"
						>
							Delete
						</button>
					) : null}
				</div>
			</Card>
		</Link>
	);
}
