import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Media } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
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
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import {
	Checkbox,
	CheckboxControl,
	CheckboxLabel,
} from "@solid-imager/ui/checkbox";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxItemLabel,
	ComboboxTrigger,
} from "@solid-imager/ui/combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { Input } from "@solid-imager/ui/input";
import { Label } from "@solid-imager/ui/label";
import { PaginationControls } from "@solid-imager/ui/pagination-controls";
import { Progress } from "@solid-imager/ui/progress";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { listen } from "@tauri-apps/api/event";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { MediaCardItem } from "../components/media/media-card-item";
import {
	createCharacter,
	deleteCharacter,
	updateCharacter,
} from "../infrastructure/api-clients/characters-api";
import {
	createIp,
	deleteIp,
	updateIp,
} from "../infrastructure/api-clients/ips-api";
import { orpc } from "../infrastructure/api-clients/orpc-client";
import {
	createProject,
	deleteProject,
	updateProject,
} from "../infrastructure/api-clients/projects-api";
import { allCharactersQueryOptions } from "../infrastructure/api-clients/queries/characters-query";
import { allIpsQueryOptions } from "../infrastructure/api-clients/queries/ips-query";
import { allProjectsQueryOptions } from "../infrastructure/api-clients/queries/projects-query";
import { mediaSourcesQueryOptions } from "../infrastructure/api-clients/queries/sources-query";

type EntityType = "projects" | "ips" | "characters" | "tagging";
type Entity = Project | Ip | Character;
type JobProgress = {
	jobId?: string;
	processed: number;
	total: number;
};
type JobCompleted = {
	jobId?: string;
	message?: string;
};
type JobFailed = {
	jobId?: string;
	error?: string;
};

function isCharacter(item: Entity): item is Character {
	return "ips" in item;
}

function parseEventPayload<T>(
	payload: unknown,
	guard: (value: Record<string, unknown>) => boolean,
): T | null {
	if (!payload || typeof payload !== "object") {
		return null;
	}
	return guard(payload as Record<string, unknown>) ? (payload as T) : null;
}

export const Route = createFileRoute("/manager")({
	loader: async ({ context }) => {
		await Promise.all([
			context.queryClient.ensureQueryData(allProjectsQueryOptions()),
			context.queryClient.ensureQueryData(allIpsQueryOptions()),
			context.queryClient.ensureQueryData(allCharactersQueryOptions()),
			context.queryClient.ensureQueryData(mediaSourcesQueryOptions()),
		]);
	},
	component: ManagerPage,
});

export default function ManagerPage() {
	const [activeTab, setActiveTab] = createSignal<EntityType>("projects");
	const [isDialogOpen, setIsDialogOpen] = createSignal(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [editingItem, setEditingItem] = createSignal<Entity | null>(null);
	const [itemToDelete, setItemToDelete] = createSignal<Entity | null>(null);
	const [formData, setFormData] = createSignal<{
		name: string;
		description: string;
		ipIds?: string[];
	}>({ name: "", description: "" });

	const [selectedSourceId, setSelectedSourceId] = createSignal<
		string | undefined
	>(undefined);
	const [forceRetag, setForceRetag] = createSignal(false);
	const [taggingStatus, setTaggingStatus] = createSignal<string | null>(null);
	const [scannedMedia, setScannedMedia] = createSignal<Media[]>([]);
	const [selectedMedia, setSelectedMedia] = createSignal<Set<string>>(
		new Set(),
	);
	const [jobProgress, setJobProgress] = createSignal<JobProgress | null>(null);
	const [activeJobId, setActiveJobId] = createSignal<string | null>(null);

	const [currentPage, setCurrentPage] = createSignal(1);
	const itemsPerPage = 50;

	const queryClient = useQueryClient();

	const projects = createQuery(() => allProjectsQueryOptions());
	const ips = createQuery(() => allIpsQueryOptions());
	const characters = createQuery(() => allCharactersQueryOptions());
	const sources = createQuery(() => mediaSourcesQueryOptions());

	const totalPages = () =>
		Math.max(1, Math.ceil(scannedMedia().length / itemsPerPage));

	const paginatedMedia = () => {
		const start = (currentPage() - 1) * itemsPerPage;
		return scannedMedia().slice(start, start + itemsPerPage);
	};

	createEffect(() => {
		if (scannedMedia().length > 0) {
			setCurrentPage(1);
		}
	});

	const invalidateQueries = async () => {
		if (activeTab() === "projects") {
			await queryClient.invalidateQueries({ queryKey: ["allProjects"] });
		} else if (activeTab() === "ips") {
			await queryClient.invalidateQueries({ queryKey: ["allIps"] });
		} else if (activeTab() === "characters") {
			await queryClient.invalidateQueries({ queryKey: ["allCharacters"] });
		}
	};

	const resetForm = () =>
		setFormData({
			name: "",
			description: "",
			ipIds: [],
		});

	const openCreateDialog = () => {
		setEditingItem(null);
		resetForm();
		setIsDialogOpen(true);
	};

	const openEditDialog = (item: Entity) => {
		setEditingItem(item);
		setFormData({
			name: item.name,
			description: item.description || "",
			ipIds: isCharacter(item) ? item.ips.map((ip) => ip.id) : [],
		});
		setIsDialogOpen(true);
	};

	const getActiveItems = () => {
		switch (activeTab()) {
			case "projects":
				return projects.data || [];
			case "ips":
				return ips.data || [];
			case "characters":
				return characters.data || [];
			default:
				return [];
		}
	};

	const saveEntity = async () => {
		const data = formData();
		const current = editingItem();
		try {
			if (!current) {
				if (activeTab() === "projects") {
					await createProject(data);
				} else if (activeTab() === "ips") {
					await createIp(data);
				} else if (activeTab() === "characters") {
					await createCharacter(data);
				}
			} else if (activeTab() === "projects") {
				await updateProject(current.id, data);
			} else if (activeTab() === "ips") {
				await updateIp(current.id, data);
			} else if (activeTab() === "characters") {
				await updateCharacter(current.id, data);
			}

			await invalidateQueries();
			toast.success(
				editingItem() ? "Updated successfully" : "Created successfully",
			);
			setIsDialogOpen(false);
			setEditingItem(null);
			resetForm();
		} catch (error) {
			toast.error(`Failed to save: ${(error as Error).message}`);
		}
	};

	const handleConfirmDelete = async () => {
		const item = itemToDelete();
		if (!item) {
			return;
		}

		try {
			if (activeTab() === "projects") {
				await deleteProject(item.id);
			} else if (activeTab() === "ips") {
				await deleteIp(item.id);
			} else if (activeTab() === "characters") {
				await deleteCharacter(item.id);
			}
			await invalidateQueries();
			toast.success("Deleted successfully");
		} catch (error) {
			toast.error(`Failed to delete: ${(error as Error).message}`);
		} finally {
			setIsDeleteDialogOpen(false);
			setItemToDelete(null);
		}
	};

	const handleScan = async () => {
		try {
			setTaggingStatus("Scanning...");
			setScannedMedia([]);
			const result = await orpc.ai.scanBatchTaggingTargets({
				force: forceRetag(),
				mediaSourceId: selectedSourceId(),
			});
			setScannedMedia(result);
			setSelectedMedia(new Set(result.map((item) => item.id)));
			setTaggingStatus(`${result.length} items found.`);
		} catch (error) {
			toast.error(`Error: ${(error as Error).message}`);
			setTaggingStatus(`Error during scan: ${(error as Error).message}`);
		}
	};

	const handleStartBatchTagging = async () => {
		if (selectedMedia().size === 0) {
			toast.error("No media selected");
			return;
		}

		try {
			setTaggingStatus("Starting...");
			setJobProgress(null);
			const result = await orpc.ai.startBatchTaggingWithIds({
				force: forceRetag(),
				mediaSourceId: selectedSourceId(),
				mediaIds: Array.from(selectedMedia()),
			});
			if (result.success && result.jobId) {
				toast.success(result.message);
				setTaggingStatus("Batch tagging in progress...");
				setActiveJobId(result.jobId);
				setScannedMedia([]);
				setSelectedMedia(new Set<string>());
			} else {
				toast.error("Failed to start batch tagging.");
				setTaggingStatus("Failed to start batch tagging.");
			}
		} catch (error) {
			toast.error(`Error: ${(error as Error).message}`);
			setTaggingStatus(`Error: ${(error as Error).message}`);
		}
	};

	createEffect(() => {
		const jobId = activeJobId();
		if (!jobId) {
			return;
		}

		const unlistenPromises = [
			listen("job-progress", (event) => {
				const data = parseEventPayload<JobProgress>(
					event.payload,
					(value): value is JobProgress =>
						typeof value.processed === "number" &&
						typeof value.total === "number" &&
						(value.jobId === undefined || typeof value.jobId === "string"),
				);
				if (data?.jobId === jobId) {
					setJobProgress(data);
					setTaggingStatus(
						`Processing: ${data.processed} / ${data.total} tagged.`,
					);
				}
			}),
			listen("job-completed", (event) => {
				const data = parseEventPayload<JobCompleted>(
					event.payload,
					(value): value is JobCompleted =>
						value.jobId === undefined || typeof value.jobId === "string",
				);
				if (data?.jobId === jobId) {
					toast.success(data.message || "Batch tagging completed!");
					setTaggingStatus("Batch tagging completed successfully.");
					setActiveJobId(null);
					setJobProgress(null);
				}
			}),
			listen("job-failed", (event) => {
				const data = parseEventPayload<JobFailed>(
					event.payload,
					(value): value is JobFailed =>
						(value.jobId === undefined || typeof value.jobId === "string") &&
						(value.error === undefined || typeof value.error === "string"),
				);
				if (data?.jobId === jobId) {
					toast.error(`Job failed: ${data.error || "unknown error"}`);
					setTaggingStatus(`Job failed: ${data.error || "unknown error"}`);
					setActiveJobId(null);
					setJobProgress(null);
				}
			}),
		];

		onCleanup(() => {
			void Promise.all(unlistenPromises).then((unlisteners) => {
				for (const unlisten of unlisteners) {
					unlisten();
				}
			});
		});
	});

	const toggleMediaSelection = (mediaId: string) => {
		setSelectedMedia((previous) => {
			const next = new Set(previous);
			if (next.has(mediaId)) {
				next.delete(mediaId);
			} else {
				next.add(mediaId);
			}
			return next;
		});
	};

	const toggleSelectAll = () => {
		if (selectedMedia().size === scannedMedia().length) {
			setSelectedMedia(new Set<string>());
		} else {
			setSelectedMedia(new Set(scannedMedia().map((item) => item.id)));
		}
	};

	return (
		<div class="container mx-auto p-8">
			<div class="mb-8 flex items-center justify-between">
				<h1 class="font-bold text-3xl">Entity Manager</h1>
				<Show when={activeTab() !== "tagging"}>
					<Button onClick={openCreateDialog}>Create New</Button>
				</Show>
			</div>

			<div class="mb-6 flex space-x-4 border-b">
				{(["projects", "ips", "characters", "tagging"] as const).map((tab) => (
					<button
						class={`border-b-2 px-4 py-2 font-medium transition-colors ${
							activeTab() === tab
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:text-foreground"
						}`}
						onClick={() => setActiveTab(tab)}
						type="button"
					>
						{tab === "tagging"
							? "Batch Tagging"
							: tab === "ips"
								? "IPs"
								: tab.charAt(0).toUpperCase() + tab.slice(1)}
					</button>
				))}
			</div>

			<Show when={activeTab() === "tagging"}>
				<div class="space-y-6">
					<Card>
						<CardHeader>
							<CardTitle>Batch AI Tagging</CardTitle>
							<CardDescription>
								Analyze and tag images across your media sources using AI.
							</CardDescription>
						</CardHeader>
						<CardContent class="space-y-4">
							<div class="grid gap-2">
								<Label>Target Media Source (Optional)</Label>
								<Select
									itemComponent={(props) => (
										<SelectItem item={props.item}>
											{props.item.rawValue.name}
										</SelectItem>
									)}
									onChange={(value) => setSelectedSourceId(value?.id)}
									options={Array.isArray(sources.data) ? sources.data : []}
									optionTextValue="name"
									optionValue="id"
									placeholder="All Sources"
									value={
										selectedSourceId()
											? (Array.isArray(sources.data) ? sources.data : []).find(
													(source) => source.id === selectedSourceId(),
												)
											: null
									}
								>
									<SelectTrigger>
										<SelectValue<unknown>>
											{(state) => {
												const option = state.selectedOption();
												return option &&
													typeof option === "object" &&
													"name" in option
													? (option as { name: string }).name
													: "All Sources";
											}}
										</SelectValue>
									</SelectTrigger>
									<SelectContent />
								</Select>
								<p class="text-muted-foreground text-xs">
									Leave empty to process all sources.
								</p>
							</div>

							<div class="flex items-center space-x-2">
								<Checkbox
									checked={forceRetag()}
									class="flex items-center space-x-2"
									id="force-retag"
									onChange={setForceRetag}
								>
									<CheckboxControl />
									<CheckboxLabel>Force Re-tagging</CheckboxLabel>
								</Checkbox>
							</div>
							<p class="text-muted-foreground text-xs">
								If checked, existing AI tags will be ignored and images will be
								re-analyzed.
							</p>

							<div class="flex items-center gap-x-2 pt-2">
								<Button onClick={handleScan}>Scan for Targets</Button>
								<Button
									disabled={scannedMedia().length === 0}
									onClick={handleStartBatchTagging}
								>
									Start Batch Tagging ({selectedMedia().size})
								</Button>
							</div>

							<Show when={taggingStatus()}>
								<div class="mt-4 rounded bg-gray-100 p-2 text-sm">
									{taggingStatus()}
								</div>
							</Show>
							<Show when={jobProgress()}>
								{(progress) => (
									<div class="mt-4">
										<Progress
											value={(progress().processed / progress().total) * 100}
										/>
									</div>
								)}
							</Show>
							<Show when={activeJobId()}>
								<p class="text-muted-foreground text-xs">
									Active job: {activeJobId()}
								</p>
							</Show>
						</CardContent>
					</Card>

					<Show when={scannedMedia().length > 0}>
						<div class="mt-4">
							<div class="mb-2 flex items-center justify-between">
								<h3 class="font-bold text-lg">
									Scanned Media ({scannedMedia().length})
								</h3>
								<div class="flex items-center gap-2">
									<PaginationControls
										currentPage={currentPage()}
										onPageChange={setCurrentPage}
										totalPages={totalPages()}
									/>
									<Button onClick={toggleSelectAll} size="sm" variant="outline">
										{selectedMedia().size === scannedMedia().length
											? "Deselect All"
											: "Select All"}
									</Button>
								</div>
							</div>

							<div class="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
								<For each={paginatedMedia()}>
									{(media) => (
										<MediaCardItem
											media={media}
											onToggle={toggleMediaSelection}
											selectable
											selected={selectedMedia().has(media.id)}
										/>
									)}
								</For>
							</div>

							<div class="mt-4 flex justify-center">
								<PaginationControls
									currentPage={currentPage()}
									onPageChange={setCurrentPage}
									totalPages={totalPages()}
								/>
							</div>
						</div>
					</Show>
				</div>
			</Show>

			<Show when={activeTab() !== "tagging"}>
				<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
					<For each={getActiveItems()}>
						{(item) => (
							<Card>
								<CardHeader>
									<CardTitle>{item.name}</CardTitle>
									<Show when={item.description}>
										<CardDescription>{item.description}</CardDescription>
									</Show>
									{activeTab() === "characters" &&
										isCharacter(item) &&
										item.ips.length > 0 && (
											<CardDescription>
												IPs: {item.ips.map((ip) => ip.name).join(", ")}
											</CardDescription>
										)}
								</CardHeader>
								<CardContent>
									<div class="flex justify-end space-x-2">
										<Button
											onClick={() => openEditDialog(item)}
											size="sm"
											variant="outline"
										>
											Edit
										</Button>
										<Button
											onClick={() => {
												setItemToDelete(item);
												setIsDeleteDialogOpen(true);
											}}
											size="sm"
											variant="destructive"
										>
											Delete
										</Button>
									</div>
								</CardContent>
							</Card>
						)}
					</For>
				</div>
			</Show>

			<Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingItem() ? "Edit" : "Create"}{" "}
							{activeTab() === "projects"
								? "PROJECT"
								: activeTab() === "ips"
									? "IP"
									: "CHARACTER"}
						</DialogTitle>
						<DialogDescription>
							{editingItem()
								? "Update the details of the item."
								: "Enter the details for the new item."}
						</DialogDescription>
					</DialogHeader>
					<div class="grid gap-4 py-4">
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right">Name</Label>
							<Input
								class="col-span-3"
								onInput={(event) =>
									setFormData({
										...formData(),
										name: event.currentTarget.value,
									})
								}
								value={formData().name}
							/>
						</div>
						<div class="grid grid-cols-4 items-center gap-4">
							<Label class="text-right">Description</Label>
							<Input
								class="col-span-3"
								onInput={(event) =>
									setFormData({
										...formData(),
										description: event.currentTarget.value,
									})
								}
								value={formData().description}
							/>
						</div>
						<Show when={activeTab() === "characters"}>
							<div class="grid grid-cols-4 items-center gap-4">
								<Label class="text-right">IPs</Label>
								<div class="col-span-3">
									<Combobox<Ip>
										itemComponent={(props) => (
											<ComboboxItem item={props.item}>
												<ComboboxItemLabel>
													{props.item.rawValue.name}
												</ComboboxItemLabel>
												<ComboboxItemIndicator />
											</ComboboxItem>
										)}
										multiple
										onChange={(values) =>
											setFormData({
												...formData(),
												ipIds: values.map((value) => value.id),
											})
										}
										optionLabel="name"
										options={ips.data || []}
										optionTextValue="name"
										optionValue="id"
										value={(ips.data || []).filter((ip) =>
											formData().ipIds?.includes(ip.id),
										)}
									>
										<ComboboxControl>
											<ComboboxInput placeholder="Select IPs..." />
											<ComboboxTrigger />
										</ComboboxControl>
										<ComboboxContent />
									</Combobox>
								</div>
							</div>
						</Show>
					</div>
					<DialogFooter>
						<Button onClick={saveEntity}>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				onOpenChange={setIsDeleteDialogOpen}
				open={isDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the{" "}
							{activeTab().slice(0, -1)}.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={handleConfirmDelete}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
