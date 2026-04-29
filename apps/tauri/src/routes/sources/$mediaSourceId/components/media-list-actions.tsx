import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import type { JSX } from "solid-js";

type MediaListActionsProps = {
	filterPanel: JSX.Element;
	isSyncDisabled: boolean;
	isSyncing: boolean;
	onAddMedia: () => void;
	onDumpDownload: () => void;
	onRestore: () => void;
	onSyncLoadedMedia: () => void;
	onZipDumpDownload: () => void;
	sourceDescription?: string | null;
	sourceName?: string;
};

export function MediaListActions(props: MediaListActionsProps) {
	return (
		<div class="mb-8 flex items-center justify-between">
			<div>
				<h1 class="mb-2 font-bold text-3xl">
					{props.sourceName ?? "Media Source"}
				</h1>
				<p class="text-gray-600">{props.sourceDescription}</p>
			</div>
			<div class="flex flex-wrap gap-2">
				<Button onClick={props.onAddMedia}>Add Media</Button>
				<Button onClick={props.onDumpDownload} variant="outline">
					Dump JSON
				</Button>
				<Button onClick={props.onZipDumpDownload} variant="outline">
					Dump ZIP
				</Button>
				<Button onClick={props.onRestore} variant="outline">
					Restore
				</Button>
				<Button
					disabled={props.isSyncDisabled}
					onClick={props.onSyncLoadedMedia}
					variant="outline"
				>
					{props.isSyncing ? "Syncing..." : "Sync Loaded Media"}
				</Button>
				<div class="md:hidden">
					<Dialog>
						<DialogTrigger as={Button} variant="outline">
							Filters
						</DialogTrigger>
						<DialogContent class="max-h-[80vh] overflow-y-auto">
							<DialogHeader>
								<DialogTitle>検索フィルター</DialogTitle>
							</DialogHeader>
							<div class="space-y-4">{props.filterPanel}</div>
						</DialogContent>
					</Dialog>
				</div>
			</div>
		</div>
	);
}
