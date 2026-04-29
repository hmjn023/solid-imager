import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import { SearchControlPanel } from "@solid-imager/ui/search-control-panel";
import type { ComponentProps } from "solid-js";
import { Show } from "solid-js";
import { isServer, Portal } from "solid-js/web";
import { PresetClient } from "~/infrastructure/api/clients/preset-client";

type FilterData = ComponentProps<typeof SearchControlPanel>["filterData"];

type MediaListActionsProps = {
	filterData: FilterData;
	onDumpDownload: (mode: "json" | "zip") => void;
	onSearch: () => void;
};

export function MediaListActions(props: MediaListActionsProps) {
	return (
		<Show when={!isServer && document.getElementById("nav-actions")}>
			<Portal mount={document.getElementById("nav-actions") as HTMLElement}>
				<Button
					class="mr-2 border-white text-white hover:bg-sky-700"
					onClick={() => props.onDumpDownload("json")}
					size="icon"
					title="Download Backup JSON"
					variant="outline"
				>
					<svg
						class="lucide lucide-file-json"
						fill="none"
						height="20"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						width="20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Download JSON</title>
						<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
						<path d="M14 2v4a2 2 0 0 0 2 2h4" />
						<path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1" />
						<path d="M10 18a1 1 0 0 0-1-1v-1a1 1 0 0 0 1-1" />
					</svg>
				</Button>
				<Button
					class="mr-2 border-white text-white hover:bg-sky-700"
					onClick={() => props.onDumpDownload("zip")}
					size="icon"
					title="Download Backup ZIP (with Images)"
					variant="outline"
				>
					<svg
						class="lucide lucide-archive"
						fill="none"
						height="20"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						width="20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Download ZIP</title>
						<rect height="5" rx="1" width="20" x="2" y="3" />
						<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
						<path d="M10 12h4" />
					</svg>
				</Button>
				<Button
					class="mr-2 border-white text-white hover:bg-sky-700"
					onClick={() => document.getElementById("restore-input")?.click()}
					size="icon"
					title="Restore Metadata from Dump"
					variant="outline"
				>
					<svg
						class="lucide lucide-upload-cloud"
						fill="none"
						height="20"
						stroke="currentColor"
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						viewBox="0 0 24 24"
						width="20"
						xmlns="http://www.w3.org/2000/svg"
					>
						<title>Restore from cloud</title>
						<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
						<path d="M12 12v9" />
						<path d="m16 16-4-4-4 4" />
					</svg>
				</Button>
				<Dialog>
					<DialogTrigger
						as={Button}
						class="border-white text-white hover:bg-sky-700 md:hidden"
						size="icon"
						variant="outline"
					>
						<svg
							class="lucide lucide-filter"
							fill="none"
							height="24"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							viewBox="0 0 24 24"
							width="24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>Filter results</title>
							<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
						</svg>
					</DialogTrigger>
					<DialogContent class="max-h-[80vh] overflow-y-auto">
						<DialogHeader>
							<DialogTitle>検索フィルター</DialogTitle>
						</DialogHeader>
						<div class="space-y-4">
							<SearchControlPanel
								class="w-full"
								context="source"
								filterData={props.filterData}
								onSearch={props.onSearch}
								presetClient={PresetClient}
							/>
						</div>
					</DialogContent>
				</Dialog>
			</Portal>
		</Show>
	);
}
