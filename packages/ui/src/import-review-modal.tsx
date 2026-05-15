import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import {
	createEffect,
	createResource,
	createSignal,
	For,
	Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import {
	getPendingImportPrimaryAuthor,
	getPreferredImportSourceId,
} from "./import-inbox-helpers";
import { toast } from "./toast";

export type PendingImportJob = {
	id: string;
	item: DownloadItem;
	createdAt: Date | string;
	targetSourceId?: string;
};

export type ImportReviewModalProps = {
	isOpen: boolean;
	onClose: () => void;
	onImportCompleted: () => void;
	listPending: () => Promise<PendingImportJob[]>;
	listSources: () => Promise<SafeMediaSource[]>;
	processPending: (
		jobIds: string[],
		targetSourceId: string,
	) => Promise<{ success: boolean; processedCount: number }>;
	cancelPending: (jobIds: string[]) => Promise<{ success: boolean }>;
};

function getPreviewUrl(url?: string): string {
	if (!url) {
		return "";
	}

	try {
		const urlObject = new URL(url);
		if (
			urlObject.hostname === "pbs.twimg.com" &&
			urlObject.searchParams.get("name") === "orig"
		) {
			urlObject.searchParams.set("name", "small");
			return urlObject.toString();
		}
	} catch {
		// Ignore invalid URLs and use the original string.
	}

	return url;
}

export function ImportReviewModal(props: ImportReviewModalProps) {
	const createEmptySelection = () => new Set<string>();
	const [selectedJobIds, setSelectedJobIds] = createSignal(
		createEmptySelection(),
	);
	const [selectedSourceId, setSelectedSourceId] = createSignal("");
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);

	const [pendingJobs, { refetch: refetchJobs }] = createResource(
		props.listPending,
	);
	const [sources] = createResource(props.listSources);

	createEffect(() => {
		if (props.isOpen) {
			void refetchJobs();
		}
	});

	createEffect(() => {
		const jobs = pendingJobs();
		if (jobs?.length) {
			setSelectedJobIds(new Set(jobs.map((job) => job.id)));
			return;
		}
		setSelectedJobIds(createEmptySelection());
	});

	createEffect(() => {
		const sourceList = sources();
		if (!sourceList?.length) {
			setSelectedSourceId("");
			return;
		}

		if (!selectedSourceId()) {
			setSelectedSourceId(getPreferredImportSourceId(sourceList));
		}
	});

	const toggleSelection = (id: string) => {
		const current = new Set(selectedJobIds());
		if (current.has(id)) {
			current.delete(id);
		} else {
			current.add(id);
		}
		setSelectedJobIds(current);
	};

	const handleProcess = async () => {
		const jobIds = Array.from(selectedJobIds());
		const sourceId = selectedSourceId();
		if (!jobIds.length || !sourceId) {
			return;
		}

		try {
			await props.processPending(jobIds, sourceId);
			props.onImportCompleted();
			props.onClose();
		} catch (error) {
			toast.error(`Failed to process imports: ${(error as Error).message}`);
		}
	};

	const confirmDelete = async () => {
		try {
			await props.cancelPending(Array.from(selectedJobIds()));
			await refetchJobs();
			setSelectedJobIds(createEmptySelection());
			toast.success("Requests deleted");
		} catch (error) {
			toast.error(`Failed to cancel imports: ${(error as Error).message}`);
		} finally {
			setIsDeleteDialogOpen(false);
		}
	};

	return (
		<Show when={props.isOpen}>
			<Portal>
				<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div class="flex max-h-[85vh] w-full max-w-4xl flex-col rounded-lg bg-gray-900 shadow-xl">
						<div class="flex items-center justify-between border-gray-700 border-b p-4">
							<h2 class="font-bold text-white text-xl">
								Review Pending Imports
							</h2>
							<button
								class="text-gray-400 hover:text-white"
								onClick={props.onClose}
								type="button"
							>
								✕
							</button>
						</div>
						<div class="flex-1 overflow-y-auto p-4">
							<div class="mb-4 flex items-center justify-between">
								<div class="flex gap-2">
									<span class="text-gray-300">Target Source:</span>
									<select
										class="rounded border border-gray-600 bg-gray-800 p-1 text-white"
										onChange={(event) =>
											setSelectedSourceId(event.currentTarget.value)
										}
										value={selectedSourceId()}
									>
										<For each={sources()}>
											{(source) => (
												<option value={source.id}>
													{source.name} ({source.type})
												</option>
											)}
										</For>
									</select>
								</div>
								<div class="text-gray-400 text-sm">
									Selected: {selectedJobIds().size} /{" "}
									{pendingJobs()?.length || 0}
								</div>
							</div>
							<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
								<For each={pendingJobs()}>
									{(job) => (
										<button
											class={`relative flex cursor-pointer flex-col rounded border p-2 text-left ${
												selectedJobIds().has(job.id)
													? "border-sky-500 bg-sky-900/20"
													: "border-gray-700 bg-gray-800"
											}`}
											onClick={() => toggleSelection(job.id)}
											type="button"
										>
											<div class="absolute top-1 right-1">
												<input
													checked={selectedJobIds().has(job.id)}
													class="h-4 w-4"
													type="checkbox"
												/>
											</div>
											<div class="aspect-square w-full overflow-hidden rounded bg-black">
												<Show
													fallback={
														<div class="flex h-full items-center justify-center text-gray-500">
															No Preview
														</div>
													}
													when={job.item.targetUrl}
												>
													<img
														alt="Preview"
														class="h-full w-full object-cover"
														onError={(event) => {
															event.currentTarget.style.display = "none";
														}}
														src={getPreviewUrl(job.item.targetUrl)}
													/>
												</Show>
											</div>
											<div class="mt-2 truncate text-gray-400 text-xs">
												{job.item.description ||
													job.item.targetUrl ||
													"No description"}
											</div>
											<div class="text-[10px] text-gray-500">
												AUTH: {getPendingImportPrimaryAuthor(job.item)}
											</div>
										</button>
									)}
								</For>
							</div>
						</div>
						<div class="flex justify-end gap-2 border-gray-700 border-t p-4">
							<button
								class="rounded px-4 py-2 text-red-400 hover:bg-red-900/20 disabled:opacity-50"
								disabled={selectedJobIds().size === 0}
								onClick={() => setIsDeleteDialogOpen(true)}
								type="button"
							>
								Delete Selected
							</button>
							<div class="flex-1" />
							<button
								class="rounded border border-gray-600 px-4 py-2 text-gray-300 hover:bg-gray-800"
								onClick={props.onClose}
								type="button"
							>
								Cancel
							</button>
							<button
								class="rounded bg-sky-600 px-6 py-2 font-bold text-white hover:bg-sky-500 disabled:opacity-50"
								disabled={selectedJobIds().size === 0 || !selectedSourceId()}
								onClick={() => void handleProcess()}
								type="button"
							>
								Import{" "}
								{selectedJobIds().size ? `(${selectedJobIds().size})` : ""}
							</button>
						</div>
					</div>
				</div>
			</Portal>
			<AlertDialog
				onOpenChange={setIsDeleteDialogOpen}
				open={isDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This will remove {selectedJobIds().size} import requests.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => void confirmDelete()}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Show>
	);
}
