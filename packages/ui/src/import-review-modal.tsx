import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { getErrorMessage } from "@solid-imager/core/utils";
import {
	createEffect,
	createResource,
	createSignal,
	For,
	Show,
} from "solid-js";
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
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import {
	getPendingImportPrimaryAuthor,
	getPreferredImportSourceId,
} from "./import-inbox-helpers";
import { LegacyImportReviewModal } from "./legacy-import-review-modal";
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
	variant?: "default" | "v2";
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
	if (props.variant !== "v2") {
		return <LegacyImportReviewModal {...props} />;
	}
	return <V2ImportReviewModal {...props} />;
}

function V2ImportReviewModal(props: ImportReviewModalProps) {
	const createEmptySelection = () => new Set<string>();
	const [selectedJobIds, setSelectedJobIds] = createSignal(
		createEmptySelection(),
	);
	const [selectedSourceId, setSelectedSourceId] = createSignal("");
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [isDiscardDialogOpen, setIsDiscardDialogOpen] = createSignal(false);
	const [isDirty, setIsDirty] = createSignal(false);
	const [activeAction, setActiveAction] = createSignal<
		"import" | "delete" | null
	>(null);

	const [pendingJobs, { refetch: refetchJobs }] = createResource(
		() => props.isOpen || undefined,
		props.listPending,
	);
	const [sources] = createResource(props.listSources);

	createEffect(() => {
		if (props.isOpen) {
			setIsDirty(false);
			setIsDiscardDialogOpen(false);
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
		setIsDirty(true);
	};
	const requestClose = () => {
		if (activeAction() !== null) return;
		if (props.variant === "v2" && isDirty()) {
			setIsDiscardDialogOpen(true);
			return;
		}
		props.onClose();
	};
	const discardAndClose = () => {
		setIsDirty(false);
		setIsDiscardDialogOpen(false);
		props.onClose();
	};

	const handleProcess = async () => {
		const jobIds = Array.from(selectedJobIds());
		const sourceId = selectedSourceId();
		if (!jobIds.length || !sourceId) {
			return;
		}

		try {
			setActiveAction("import");
			await props.processPending(jobIds, sourceId);
			setIsDirty(false);
			props.onImportCompleted();
			props.onClose();
		} catch (error) {
			toast.error(`Failed to process imports: ${getErrorMessage(error)}`);
		} finally {
			setActiveAction(null);
		}
	};

	const confirmDelete = async () => {
		try {
			setActiveAction("delete");
			await props.cancelPending(Array.from(selectedJobIds()));
			await refetchJobs();
			setSelectedJobIds(createEmptySelection());
			setIsDirty(false);
			toast.success("Requests deleted");
		} catch (error) {
			toast.error(`Failed to cancel imports: ${getErrorMessage(error)}`);
		} finally {
			setActiveAction(null);
			setIsDeleteDialogOpen(false);
		}
	};

	return (
		<>
			<Dialog
				onOpenChange={(open) => {
					if (!open) {
						requestClose();
					}
				}}
				open={props.isOpen}
			>
				<DialogContent
					class={`flex max-h-[min(52rem,calc(100dvh-2rem))] max-w-5xl flex-col gap-0 overflow-hidden p-0 ${props.variant === "v2" ? "v2-theme" : ""}`}
				>
					<DialogHeader class="border-b px-5 py-4 pr-12">
						<DialogTitle>Import inbox</DialogTitle>
						<DialogDescription>
							Review downloaded media, choose a source, then import the selected
							items.
						</DialogDescription>
					</DialogHeader>

					<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
						<div
							class={`flex flex-col gap-3 border-b px-5 py-3 sm:flex-row sm:items-end sm:justify-between ${props.variant === "v2" ? "bg-[var(--v2-surface-muted)]" : "bg-muted"}`}
						>
							<label class="grid min-w-0 gap-1 font-medium text-sm sm:w-80">
								Target source
								<select
									class="min-h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
									disabled={sources.loading || activeAction() !== null}
									onChange={(event) => {
										setSelectedSourceId(event.currentTarget.value);
										setIsDirty(true);
									}}
									value={selectedSourceId()}
								>
									<For each={sources()}>
										{(source) => (
											<option value={source.id}>
												{source.name} · {source.type}
											</option>
										)}
									</For>
								</select>
							</label>
							<div class="text-muted-foreground text-sm" aria-live="polite">
								{selectedJobIds().size} of {pendingJobs()?.length ?? 0} selected
							</div>
						</div>

						<div class="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5">
							<Show when={pendingJobs.loading}>
								<div class="flex min-h-48 items-center justify-center text-muted-foreground text-sm">
									Loading import inbox…
								</div>
							</Show>
							<Show
								when={
									!pendingJobs.loading &&
									!pendingJobs.error &&
									(pendingJobs()?.length ?? 0) > 0
								}
							>
								<div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
									<For each={pendingJobs()}>
										{(job) => (
											<label
												class={`relative min-w-0 cursor-pointer rounded-lg border p-2 transition-colors focus-within:ring-2 focus-within:ring-ring ${
													selectedJobIds().has(job.id)
														? "border-primary bg-primary/5"
														: "border-border bg-card hover:bg-accent/50"
												}`}
											>
												<input
													checked={selectedJobIds().has(job.id)}
													class="peer sr-only"
													disabled={activeAction() !== null}
													onChange={() => toggleSelection(job.id)}
													type="checkbox"
												/>
												<span class="absolute top-3 right-3 z-10 flex size-5 items-center justify-center rounded border border-input bg-background font-bold text-primary text-xs peer-checked:border-primary peer-checked:bg-primary peer-checked:text-primary-foreground">
													{selectedJobIds().has(job.id) ? "✓" : ""}
												</span>
												<div class="aspect-[4/3] w-full overflow-hidden rounded-md bg-muted">
													<Show
														fallback={
															<div class="flex h-full items-center justify-center text-muted-foreground text-xs">
																No preview
															</div>
														}
														when={job.item.targetUrl}
													>
														<img
															alt="Import preview"
															class="h-full w-full object-cover"
															onError={(event) => {
																event.currentTarget.style.display = "none";
															}}
															src={getPreviewUrl(job.item.targetUrl)}
														/>
													</Show>
												</div>
												<div class="mt-2 truncate font-medium text-sm">
													{job.item.description ||
														job.item.targetUrl ||
														"Untitled import"}
												</div>
												<div class="truncate text-muted-foreground text-xs">
													{getPendingImportPrimaryAuthor(job.item)}
												</div>
											</label>
										)}
									</For>
								</div>
							</Show>
							<Show when={!pendingJobs.loading && pendingJobs.error}>
								<div class="flex min-h-48 flex-col items-center justify-center gap-3 text-center">
									<p class="text-destructive text-sm">
										Failed to load import inbox.
									</p>
									<Button onClick={() => void refetchJobs()} variant="outline">
										Retry
									</Button>
								</div>
							</Show>
							<Show
								when={
									!pendingJobs.loading &&
									!pendingJobs.error &&
									pendingJobs()?.length === 0
								}
							>
								<div class="flex min-h-48 flex-col items-center justify-center gap-1 text-center">
									<p class="font-medium">Import inbox is empty</p>
									<p class="text-muted-foreground text-sm">
										New bulk-upload requests will appear here.
									</p>
								</div>
							</Show>
						</div>
					</div>

					<DialogFooter class="border-t px-5 py-3">
						<Button
							class="sm:mr-auto"
							disabled={selectedJobIds().size === 0 || activeAction() !== null}
							onClick={() => setIsDeleteDialogOpen(true)}
							variant="destructive"
						>
							Delete selected
						</Button>
						<Button
							disabled={activeAction() !== null}
							onClick={requestClose}
							variant="outline"
						>
							Close
						</Button>
						<Button
							disabled={
								selectedJobIds().size === 0 ||
								!selectedSourceId() ||
								activeAction() !== null
							}
							onClick={() => void handleProcess()}
						>
							{activeAction() === "import"
								? "Importing…"
								: `Import${selectedJobIds().size ? ` (${selectedJobIds().size})` : ""}`}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
			<AlertDialog
				onOpenChange={setIsDiscardDialogOpen}
				open={isDiscardDialogOpen()}
			>
				<AlertDialogContent
					class={props.variant === "v2" ? "v2-theme" : undefined}
				>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard selected changes?</AlertDialogTitle>
						<AlertDialogDescription>
							Your selected items and target source have not been imported yet.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Continue reviewing</AlertDialogCancel>
						<AlertDialogAction onClick={discardAndClose}>
							Discard and close
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
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
							disabled={activeAction() === "delete"}
							onClick={() => void confirmDelete()}
						>
							{activeAction() === "delete" ? "Deleting…" : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
