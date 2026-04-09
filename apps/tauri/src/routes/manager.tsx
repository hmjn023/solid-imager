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
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, For, onCleanup, Show } from "solid-js";
import { MediaCardItem } from "../components/media/media-card-item";
import {
	type MockAssociation,
	type MockCharacter,
	type MockEntity,
	mockCharacters,
	mockIps,
	mockMedia,
	mockProjects,
	mockSources,
} from "../mocks/demo-data";

type EntityType = "projects" | "ips" | "characters" | "tagging";
type Entity = MockEntity | MockCharacter;

function isMockCharacter(item: Entity): item is MockCharacter {
	return "ipIds" in item;
}

export const Route = createFileRoute("/manager")({
	component: ManagerPage,
});

export default function ManagerPage() {
	const [activeTab, setActiveTab] = createSignal<EntityType>("projects");
	const [isDialogOpen, setIsDialogOpen] = createSignal(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [editingItem, setEditingItem] = createSignal<Entity | null>(null);
	const [itemToDelete, setItemToDelete] = createSignal<Entity | null>(null);

	const [projects, setProjects] = createSignal(
		mockProjects.map((item) => ({ ...item })),
	);
	const [ips, setIps] = createSignal(mockIps.map((item) => ({ ...item })));
	const [characters, setCharacters] = createSignal(
		mockCharacters.map((item) => ({ ...item, ipIds: [...item.ipIds] })),
	);

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
	const [scannedMedia, setScannedMedia] = createSignal<typeof mockMedia>([]);
	const [selectedMedia, setSelectedMedia] = createSignal<Set<string>>(
		new Set(),
	);
	const [jobProgress, setJobProgress] = createSignal<{
		processed: number;
		total: number;
	} | null>(null);
	const [activeJobId, setActiveJobId] = createSignal<string | null>(null);
	const [currentPage, setCurrentPage] = createSignal(1);
	const itemsPerPage = 6;

	let timer: ReturnType<typeof setInterval> | undefined;

	const totalPages = () =>
		Math.max(1, Math.ceil(scannedMedia().length / itemsPerPage));
	const paginatedMedia = () => {
		const start = (currentPage() - 1) * itemsPerPage;
		return scannedMedia().slice(start, start + itemsPerPage);
	};

	const resetForm = () => setFormData({ name: "", description: "", ipIds: [] });

	const openCreateDialog = () => {
		setEditingItem(null);
		resetForm();
		setIsDialogOpen(true);
	};

	const openEditDialog = (item: Entity) => {
		setEditingItem(item);
		setFormData({
			description: item.description || "",
			ipIds: "ipIds" in item ? [...item.ipIds] : [],
			name: item.name,
		});
		setIsDialogOpen(true);
	};

	const getActiveItems = () => {
		switch (activeTab()) {
			case "projects":
				return projects();
			case "ips":
				return ips();
			case "characters":
				return characters();
			default:
				return [];
		}
	};

	const saveEntity = () => {
		const data = formData();
		const currentId = editingItem()?.id ?? `${activeTab()}-${Date.now()}`;

		if (activeTab() === "projects") {
			setProjects((items) =>
				upsertEntity(items, {
					description: data.description,
					id: currentId,
					itemCount: editingItem()?.itemCount ?? 0,
					name: data.name,
				}),
			);
		} else if (activeTab() === "ips") {
			setIps((items) =>
				upsertEntity(items, {
					description: data.description,
					id: currentId,
					itemCount: editingItem()?.itemCount ?? 0,
					name: data.name,
				}),
			);
		} else if (activeTab() === "characters") {
			setCharacters((items) =>
				upsertEntity(items, {
					description: data.description,
					id: currentId,
					ipIds: [...(data.ipIds ?? [])],
					itemCount: editingItem()?.itemCount ?? 0,
					name: data.name,
				}),
			);
		}

		toast.success(
			editingItem() ? "Updated successfully" : "Created successfully",
		);
		setIsDialogOpen(false);
		setEditingItem(null);
		resetForm();
	};

	const handleConfirmDelete = () => {
		const item = itemToDelete();
		if (!item) {
			return;
		}

		if (activeTab() === "projects") {
			setProjects((items) =>
				items.filter((candidate) => candidate.id !== item.id),
			);
		} else if (activeTab() === "ips") {
			setIps((items) => items.filter((candidate) => candidate.id !== item.id));
		} else if (activeTab() === "characters") {
			setCharacters((items) =>
				items.filter((candidate) => candidate.id !== item.id),
			);
		}

		toast.success("Deleted successfully");
		setIsDeleteDialogOpen(false);
		setItemToDelete(null);
	};

	const handleScan = () => {
		setTaggingStatus("Scanning...");
		const results = selectedSourceId()
			? mockMedia.filter((item) => item.mediaSourceId === selectedSourceId())
			: mockMedia;
		setScannedMedia(results);
		setSelectedMedia(new Set(results.map((item) => item.id)));
		setCurrentPage(1);
		setTaggingStatus(`${results.length} items found.`);
	};

	const handleStartBatchTagging = () => {
		if (selectedMedia().size === 0) {
			toast.error("No media selected");
			return;
		}

		if (timer) {
			clearInterval(timer);
		}

		const total = selectedMedia().size;
		setTaggingStatus("Batch tagging in progress...");
		setActiveJobId(`mock-job-${Date.now()}`);
		setJobProgress({ processed: 0, total });

		timer = setInterval(() => {
			setJobProgress((progress) => {
				if (!progress) {
					return progress;
				}
				const next = {
					processed: Math.min(progress.total, progress.processed + 1),
					total: progress.total,
				};
				setTaggingStatus(
					`Processing: ${next.processed} / ${next.total} tagged.`,
				);
				if (next.processed >= next.total) {
					if (timer) {
						clearInterval(timer);
					}
					setActiveJobId(null);
					toast.success(
						`Batch tagging completed${forceRetag() ? " with force retag" : ""}.`,
					);
					setTaggingStatus("Batch tagging completed successfully.");
				}
				return next;
			});
		}, 350);
	};

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

	onCleanup(() => {
		if (timer) {
			clearInterval(timer);
		}
	});

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
									options={mockSources}
									optionTextValue="name"
									optionValue="id"
									placeholder="All Sources"
									value={
										selectedSourceId()
											? mockSources.find(
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
								<div class="mt-4 rounded bg-muted p-2 text-sm">
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
										<Show
											when={
												activeTab() === "characters" &&
												isMockCharacter(item) &&
												item.ipIds.length > 0
											}
										>
											<CardDescription>
												IPs:{" "}
												{(isMockCharacter(item) ? item.ipIds : [])
													.map(
														(ipId: string) =>
															mockIps.find((ip) => ip.id === ipId)?.name ?? ipId,
													)
													.join(", ")}
											</CardDescription>
									</Show>
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
							{activeTab().slice(0, -1).toUpperCase()}
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
									<Combobox<MockAssociation>
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
										options={mockIps}
										optionTextValue="name"
										optionValue="id"
										value={mockIps.filter((ip) =>
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
							{activeTab().slice(0, -1)} and remove it from our preview data.
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

function upsertEntity<T extends Entity>(items: T[], nextItem: T) {
	return items.some((item) => item.id === nextItem.id)
		? items.map((item) => (item.id === nextItem.id ? nextItem : item))
		: [nextItem, ...items];
}
