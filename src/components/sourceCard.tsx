import type { MediaSource } from "../db/schema";
import { Button } from "./ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "./ui/card";

interface SourceCardProps {
	mediaSource: MediaSource;
	onEdit: (source: MediaSource) => void;
	onDelete: (source: MediaSource) => void;
}

export default function SourceCard(props: SourceCardProps) {
	return (
		<Card class="relative">
			<CardHeader>
				<CardTitle>{props.mediaSource.name}</CardTitle>
			</CardHeader>
			<CardContent>
				<CardDescription>{props.mediaSource.description}</CardDescription>
				<p>Type: {props.mediaSource.type}</p>
				{/* HACK: connectionInfo is not guaranteed to be an object with path */}
				<p>
					Path:{" "}
					{typeof props.mediaSource.connectionInfo === "object" &&
					props.mediaSource.connectionInfo !== null &&
					"path" in props.mediaSource.connectionInfo
						? String(props.mediaSource.connectionInfo.path)
						: "N/A"}
				</p>
			</CardContent>
			<div class="absolute top-4 right-4 flex gap-2">
				<Button
					variant="outline"
					size="sm"
					onClick={() => props.onEdit(props.mediaSource)}
				>
					Edit
				</Button>
				<Button
					variant="destructive"
					size="sm"
					onClick={() => props.onDelete(props.mediaSource)}
				>
					Delete
				</Button>
			</div>
		</Card>
	);
}
