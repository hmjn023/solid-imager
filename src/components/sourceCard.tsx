import { Button } from "~/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "~/components/ui/card";
import type { mediaSourceInfo } from "~/lib/types";

interface SourceCardProps {
	mediaSource: mediaSourceInfo;
	onEdit: (source: mediaSourceInfo) => void;
	onDelete: (sourceName: string) => void;
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
				<p>Path: {props.mediaSource.connectionInfo.path}</p>
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
					onClick={() => props.onDelete(props.mediaSource.name)}
				>
					Delete
				</Button>
			</div>
		</Card>
	);
}
