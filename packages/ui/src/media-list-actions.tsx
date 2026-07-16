import { ClientOnly } from "@tanstack/solid-router";
import { createSignal, onMount, Show } from "solid-js";
import { Portal } from "solid-js/web";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";

export type MediaListActionsProps = {
	onDumpDownload: (mode: "json" | "zip") => void;
	onOpenMobileFilters: () => void;
	onLanceDBDump?: (includeMedia: boolean) => void;
};

const navButtonClass = "border-white text-white hover:bg-sky-700";

export function MediaListActions(props: MediaListActionsProps) {
	const [isLanceDBDialogOpen, setIsLanceDBDialogOpen] = createSignal(false);
	const [isMobileActionsOpen, setIsMobileActionsOpen] = createSignal(false);
	const [navActions, setNavActions] = createSignal<HTMLElement | null>(null);

	const handleRestore = () => {
		document.getElementById("restore-input")?.click();
	};
	const openLanceDBDialog = () => {
		setIsMobileActionsOpen(false);
		setIsLanceDBDialogOpen(true);
	};

	onMount(() => {
		setNavActions(document.getElementById("nav-actions"));
	});

	return (
		<ClientOnly>
			<Show when={navActions()}>
				{(mount) => (
					<Portal mount={mount()}>
						<div class="hidden items-center gap-2 md:flex">
							<Button
								aria-label="Download NDJSON metadata dump"
								class={navButtonClass}
								onClick={() => props.onDumpDownload("json")}
								size="icon"
								title="Download NDJSON Metadata Dump"
								variant="outline"
							>
								<svg
									aria-hidden="true"
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
									<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
									<path d="M14 2v4a2 2 0 0 0 2 2h4" />
									<path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1" />
									<path d="M10 18a1 1 0 0 0-1-1v-1a1 1 0 0 0 1-1" />
								</svg>
							</Button>
							<Button
								aria-label="Download TAR dump with images"
								class={navButtonClass}
								onClick={() => props.onDumpDownload("zip")}
								size="icon"
								title="Download TAR Dump (with Images)"
								variant="outline"
							>
								<svg
									aria-hidden="true"
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
									<rect height="5" rx="1" width="20" x="2" y="3" />
									<path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
									<path d="M10 12h4" />
								</svg>
							</Button>
							<Button
								aria-label="Download LanceDB dump"
								class={navButtonClass}
								onClick={() => setIsLanceDBDialogOpen(true)}
								size="icon"
								title="Download LanceDB Dump"
								variant="outline"
							>
								<svg
									aria-hidden="true"
									class="lucide lucide-database"
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
									<ellipse cx="12" cy="5" rx="9" ry="3" />
									<path d="M3 5V19A9 3 0 0 0 21 19V5" />
									<path d="M3 12A9 3 0 0 0 21 12" />
								</svg>
							</Button>
							<Button
								aria-label="Import source dump"
								class={navButtonClass}
								onClick={handleRestore}
								size="icon"
								title="Import Dump"
								variant="outline"
							>
								<svg
									aria-hidden="true"
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
									<path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
									<path d="M12 12v9" />
									<path d="m16 16-4-4-4 4" />
								</svg>
							</Button>
						</div>

						<Dialog
							onOpenChange={setIsMobileActionsOpen}
							open={isMobileActionsOpen()}
						>
							<DialogTrigger
								aria-label="ソース操作を開く"
								as={Button}
								class={`size-11 ${navButtonClass} md:hidden`}
								size="icon"
								variant="outline"
							>
								<svg
									aria-hidden="true"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<circle cx="5" cy="12" r="1" />
									<circle cx="12" cy="12" r="1" />
									<circle cx="19" cy="12" r="1" />
								</svg>
							</DialogTrigger>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>ソース操作</DialogTitle>
									<DialogDescription>
										メタデータの書き出しと復元を行えます。
									</DialogDescription>
								</DialogHeader>
								<div class="grid gap-2">
									<Button
										class="justify-start"
										onClick={() => props.onDumpDownload("json")}
										variant="outline"
									>
										NDJSON メタデータを書き出す
									</Button>
									<Button
										class="justify-start"
										onClick={() => props.onDumpDownload("zip")}
										variant="outline"
									>
										画像を含む TAR を書き出す
									</Button>
									<Button
										class="justify-start"
										onClick={openLanceDBDialog}
										variant="outline"
									>
										LanceDB を書き出す
									</Button>
									<Button
										class="justify-start"
										onClick={() => {
											setIsMobileActionsOpen(false);
											handleRestore();
										}}
										variant="outline"
									>
										ダンプを復元する
									</Button>
								</div>
							</DialogContent>
						</Dialog>

						<Button
							aria-label="Filter results"
							class={`size-11 ${navButtonClass} md:hidden`}
							onClick={props.onOpenMobileFilters}
							size="icon"
							title="Filter results"
							variant="outline"
						>
							<svg
								aria-hidden="true"
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
								<polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
							</svg>
						</Button>
						<Dialog
							onOpenChange={setIsLanceDBDialogOpen}
							open={isLanceDBDialogOpen()}
						>
							<DialogContent>
								<DialogHeader>
									<DialogTitle>LanceDB Dump</DialogTitle>
									<DialogDescription>
										Include media file data in the LanceDB dump? Media files
										will be stored as binary data within the LanceDB table.
										Excluding them will produce a smaller dump containing only
										metadata.
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button
										onClick={() => {
											props.onLanceDBDump?.(false);
											setIsLanceDBDialogOpen(false);
										}}
										variant="outline"
									>
										Metadata only
									</Button>
									<Button
										onClick={() => {
											props.onLanceDBDump?.(true);
											setIsLanceDBDialogOpen(false);
										}}
									>
										Include media files
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</Portal>
				)}
			</Show>
		</ClientOnly>
	);
}
