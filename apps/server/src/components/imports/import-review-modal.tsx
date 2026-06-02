import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@solid-imager/ui/alert-dialog";
import { toast } from "@solid-imager/ui/toast";
import {
	createEffect,
	createResource,
	createSignal,
	For,
	Show,
} from "solid-js";
import { Portal } from "solid-js/web";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	onImportCompleted: () => void;
};

function getPreviewUrl(url?: string): string {
	if (!url) return "";
	try {
		const urlObj = new URL(url);
		if (
			urlObj.hostname === "pbs.twimg.com" &&
			urlObj.searchParams.get("name") === "orig"
		) {
			urlObj.searchParams.set("name", "small");
			return urlObj.toString();
		}
	} catch {
		// Not a valid URL, return original string below
	}
	return url;
}

export default function ImportReviewModal(props: Props) {
	const [selectedJobIds, setSelectedJobIds] = createSignal<Set<string>>(
		new Set(),
	);
	const [selectedSourceId, setSelectedSourceId] = createSignal<string>("");
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);

	const [pendingJobs, { refetch: refetchJobs }] = createResource(async () => {
		try {
			return await orpc.imports.listPending();
		} catch (_e) {
			return [];
		}
	});

	const [sources] = createResource(async () => {
		try {
			return await orpc.sources.list();
		} catch (_e) {
			return [];
		}
	});

	createEffect(() => {
		if (props.isOpen) {
			refetchJobs();
		}
	});

	// Auto-select all by default when jobs load
	createEffect(() => {
		const jobs = pendingJobs();
		if (jobs && jobs.length > 0) {
			const allIds = new Set(
				jobs.map((j: { id: string }) => j.id),
			) as Set<string>;
			setSelectedJobIds(allIds);
		}
	});

	// Auto-select first source if available
	createEffect(() => {
		const s = sources();
		if (s && s.length > 0 && !selectedSourceId()) {
			// Prefer 'Local' source if possible or just first
			const defaultSource =
				s.find(
					(src: { name: string }) => src.name.toLowerCase() === "default",
				) || s[0];
			setSelectedSourceId(defaultSource?.id || "");
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
		const sourceId = selectedSourceId();
		const jobIds = Array.from(selectedJobIds());

		if (!sourceId || jobIds.length === 0) {
			return;
		}

		try {
			await orpc.imports.process({
				jobIds,
				targetSourceId: sourceId,
			});
			props.onImportCompleted();
			props.onClose();
		} catch (e) {
			toast.error(`Failed to process imports: ${(e as Error).message}`);
		}
	};

	const handleCancelSelected = () => {
		if (selectedJobIds().size === 0) {
			return;
		}
		setIsDeleteDialogOpen(true);
	};

	const confirmDelete = async () => {
		const jobIds = Array.from(selectedJobIds());
		try {
			await orpc.imports.cancel({ jobIds });
			refetchJobs();
			setSelectedJobIds(new Set<string>());
			toast.success("Requests deleted");
		} catch (_e) {
			toast.error("Failed to cancel imports");
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
										onChange={(e) => setSelectedSourceId(e.currentTarget.value)}
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
														onError={(e) => {
															e.currentTarget.style.display = "none";
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
												AUTH: {job.item.authors?.[0]?.name || "?"}
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
								onClick={handleCancelSelected}
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
								onClick={handleProcess}
								type="button"
							>
								Import{" "}
								{selectedJobIds().size > 0 ? `(${selectedJobIds().size})` : ""}
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
							This will remove {selectedJobIds().size} import requests. This
							action cannot be undone.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={confirmDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Show>
	);
}
