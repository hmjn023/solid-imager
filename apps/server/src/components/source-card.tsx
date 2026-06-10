import {
	localConnectionSchema,
	type MediaSourceInfo,
	type SafeMediaSource,
	s3ConnectionSchema,
	sftpConnectionSchema,
} from "@solid-imager/core/domain/sources/schemas";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";

/**
 * Props for the SourceCard component.
 * @property {SafeMediaSource | MediaSourceInfo} mediaSource - The media source object to display.
 * @property {(source: SafeMediaSource | MediaSourceInfo) => void} [onEdit] - Callback function when the edit button is clicked.
 * @property {(source: SafeMediaSource | MediaSourceInfo) => void} [onDelete] - Callback function when the delete button is clicked.
 */
type SourceCardProps = {
	mediaSource: SafeMediaSource | MediaSourceInfo;
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
	const info = source.connectionInfo;

	if (source.type === "local") {
		const parsed = localConnectionSchema.safeParse(info);
		return `Path: ${parsed.success ? parsed.data.path : "N/A"}`;
	}
	if (source.type === "sftp") {
		const parsed = sftpConnectionSchema.safeParse(info);
		return parsed.success
			? `SFTP: ${parsed.data.host}:${parsed.data.remotePath}`
			: "SFTP: Invalid connection info";
	}
	if (source.type === "s3") {
		const parsed = s3ConnectionSchema.safeParse(info);
		return parsed.success
			? `S3: ${parsed.data.bucket} (${parsed.data.region})`
			: "S3: Invalid connection info";
	}
	return "Unknown Connection";
};

/**
 * A card component to display information about a single media source.
 * It includes options to edit and delete the media source.
 * @param {SourceCardProps} props - The properties for the SourceCard component.
 * @returns {JSX.Element} The rendered media source card.
 */
export default function SourceCard(props: SourceCardProps) {
	const handleEditClick = (e: MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		props.onEdit?.(props.mediaSource);
	};

	const handleSyncClick = (e: MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		props.onSync?.(props.mediaSource);
	};

	const handleDeleteClick = (e: MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		props.onDelete?.(props.mediaSource);
	};

	return (
		<a
			class="block text-current no-underline"
			href={`/sources/${props.mediaSource.id}`}
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
				{/* 編集ボタンと削除ボタン */}
				<div class="absolute top-2 right-2 z-10 flex gap-1">
					{props.onSync && (
						<button
							class="rounded border bg-white px-2 py-1 text-xs shadow hover:bg-gray-50"
							data-testid="sync-source-btn"
							onClick={handleSyncClick}
							type="button"
						>
							Sync
						</button>
					)}
					{props.onEdit && (
						<button
							class="rounded border bg-white px-2 py-1 text-xs shadow hover:bg-gray-50"
							data-testid="edit-source-btn"
							onClick={handleEditClick}
							type="button"
						>
							Edit
						</button>
					)}
					{props.onDelete && (
						<button
							class="rounded bg-red-500 px-2 py-1 text-white text-xs shadow hover:bg-red-600"
							data-testid="delete-source-btn"
							onClick={handleDeleteClick}
							type="button"
						>
							Delete
						</button>
					)}
				</div>
			</Card>
		</a>
	);
}
