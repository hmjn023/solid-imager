import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { Input } from "@solid-imager/ui/input";
import { Label } from "@solid-imager/ui/label";
import { Progress } from "@solid-imager/ui/progress";
import {
	Switch,
	SwitchControl,
	SwitchLabel,
	SwitchThumb,
} from "@solid-imager/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@solid-imager/ui/tabs";
import { Textarea } from "@solid-imager/ui/textarea";
import { toast } from "@solid-imager/ui/toast";
import { createFileRoute } from "@tanstack/solid-router";
import { createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import {
	mockCharacters,
	mockIps,
	mockMedia,
	mockProjects,
	mockSources,
} from "../mocks/demo-data";

type EntityTab = "projects" | "ips" | "characters";
type EditableEntity = {
	id: string;
	name: string;
	description: string;
	itemCount: number;
};

export const Route = createFileRoute("/manager")({
	component: ManagerRoute,
});

function ManagerRoute() {
	const [activeTab, setActiveTab] = createSignal<EntityTab>("projects");
	const [projects, setProjects] = createSignal(
		mockProjects.map((item) => ({ ...item })),
	);
	const [ips, setIps] = createSignal(mockIps.map((item) => ({ ...item })));
	const [characters, setCharacters] = createSignal(
		mockCharacters.map((item) => ({ ...item })),
	);
	const [isDialogOpen, setIsDialogOpen] = createSignal(false);
	const [editingId, setEditingId] = createSignal<string | null>(null);
	const [draftName, setDraftName] = createSignal("");
	const [draftDescription, setDraftDescription] = createSignal("");
	const [selectedSourceId, setSelectedSourceId] = createSignal(
		mockSources[0].id,
	);
	const [selectedMediaIds, setSelectedMediaIds] = createSignal<string[]>([]);
	const [forceRetag, setForceRetag] = createSignal(false);
	const [progressValue, setProgressValue] = createSignal(0);
	const [isRunning, setIsRunning] = createSignal(false);

	let timer: ReturnType<typeof setInterval> | undefined;

	const taggingCandidates = createMemo(() =>
		mockMedia.filter((item) => item.mediaSourceId === selectedSourceId()),
	);

	const openCreateDialog = () => {
		setEditingId(null);
		setDraftName("");
		setDraftDescription("");
		setIsDialogOpen(true);
	};

	const openEditDialog = (item: EditableEntity) => {
		setEditingId(item.id);
		setDraftName(item.name);
		setDraftDescription(item.description);
		setIsDialogOpen(true);
	};

	const closeDialog = () => {
		setIsDialogOpen(false);
		setEditingId(null);
	};

	const saveEntity = () => {
		const payload = {
			id: editingId() ?? `${activeTab()}-${Date.now()}`,
			name: draftName() || "Untitled",
			description: draftDescription() || "No description yet.",
			itemCount: 0,
		};

		const updateCollection = (items: EditableEntity[]) =>
			editingId()
				? items.map((item) =>
						item.id === payload.id ? { ...item, ...payload } : item,
					)
				: [payload, ...items];

		switch (activeTab()) {
			case "projects":
				setProjects(updateCollection);
				break;
			case "ips":
				setIps(updateCollection);
				break;
			case "characters":
				setCharacters((items) =>
					editingId()
						? items.map((item) =>
								item.id === payload.id
									? {
											...item,
											description: payload.description,
											itemCount: payload.itemCount,
											name: payload.name,
										}
									: item,
							)
						: [...items, { ...payload, ipIds: [] }],
				);
				break;
		}

		toast.success(`${editingId() ? "Updated" : "Created"} ${activeTab()} item`);
		closeDialog();
	};

	const removeEntity = (id: string) => {
		switch (activeTab()) {
			case "projects":
				setProjects((items) => items.filter((item) => item.id !== id));
				break;
			case "ips":
				setIps((items) => items.filter((item) => item.id !== id));
				break;
			case "characters":
				setCharacters((items) => items.filter((item) => item.id !== id));
				break;
		}
		toast.success(`Removed ${activeTab()} item`);
	};

	const toggleMediaSelection = (mediaId: string) => {
		setSelectedMediaIds((items) =>
			items.includes(mediaId)
				? items.filter((item) => item !== mediaId)
				: [...items, mediaId],
		);
	};

	const startBatchTagging = () => {
		if (selectedMediaIds().length === 0) {
			toast.error("Select at least one media item");
			return;
		}

		if (timer) {
			clearInterval(timer);
		}

		setProgressValue(0);
		setIsRunning(true);
		timer = setInterval(() => {
			setProgressValue((value) => {
				const nextValue = Math.min(100, value + 20);
				if (nextValue === 100) {
					if (timer) {
						clearInterval(timer);
					}
					setIsRunning(false);
					toast.success(
						`Mock batch tagging finished${forceRetag() ? " with force retag" : ""}`,
					);
				}
				return nextValue;
			});
		}, 400);
	};

	onCleanup(() => {
		if (timer) {
			clearInterval(timer);
		}
	});

	return (
		<section class="grid gap-6">
			<div class="flex items-center justify-between gap-4">
				<div class="grid gap-2">
					<h1 class="font-semibold text-4xl tracking-tight">Manager</h1>
					<p class="text-muted-foreground">
						Server 側の entity 管理と batch tagging の構成をローカル state で
						再現しています。
					</p>
				</div>
				<Button onClick={openCreateDialog}>New Item</Button>
			</div>

			<Tabs
				class="grid gap-4"
				onChange={(value) => {
					if (
						value === "projects" ||
						value === "ips" ||
						value === "characters"
					) {
						setActiveTab(value);
					}
				}}
				value={activeTab()}
			>
				<TabsList class="grid h-auto grid-cols-2 gap-2 p-1 md:grid-cols-4">
					<TabsTrigger value="projects">Projects</TabsTrigger>
					<TabsTrigger value="ips">IPs</TabsTrigger>
					<TabsTrigger value="characters">Characters</TabsTrigger>
					<TabsTrigger value="tagging">Tagging</TabsTrigger>
				</TabsList>

				<TabsContent value="projects">
					<EntityGrid
						items={projects()}
						onDelete={removeEntity}
						onEdit={openEditDialog}
					/>
				</TabsContent>
				<TabsContent value="ips">
					<EntityGrid
						items={ips()}
						onDelete={removeEntity}
						onEdit={openEditDialog}
					/>
				</TabsContent>
				<TabsContent value="characters">
					<EntityGrid
						items={characters().map((item) => ({
							description: `${item.description} (${item.ipIds.length} linked IPs)`,
							id: item.id,
							itemCount: item.itemCount,
							name: item.name,
						}))}
						onDelete={removeEntity}
						onEdit={openEditDialog}
					/>
				</TabsContent>
				<TabsContent value="tagging">
					<Card>
						<CardHeader>
							<CardTitle>Batch Tagging</CardTitle>
						</CardHeader>
						<CardContent class="grid gap-6">
							<div class="grid gap-4 md:grid-cols-[1fr_auto] md:items-end">
								<div class="grid gap-2">
									<Label for="tagging-source">Source</Label>
									<div class="flex flex-wrap gap-2">
										<For each={mockSources}>
											{(source) => (
												<Button
													onClick={() => {
														setSelectedSourceId(source.id);
														setSelectedMediaIds([]);
													}}
													variant={
														selectedSourceId() === source.id
															? "default"
															: "outline"
													}
												>
													{source.name}
												</Button>
											)}
										</For>
									</div>
								</div>
								<Switch checked={forceRetag()} onChange={setForceRetag}>
									<div class="flex items-center gap-3">
										<SwitchControl>
											<SwitchThumb />
										</SwitchControl>
										<SwitchLabel>Force retag</SwitchLabel>
									</div>
								</Switch>
							</div>

							<div class="grid gap-3 rounded-xl border p-4">
								<div class="flex items-center justify-between">
									<h2 class="font-medium">Candidate Media</h2>
									<Badge variant="outline">
										{selectedMediaIds().length} selected
									</Badge>
								</div>
								<div class="grid gap-3 md:grid-cols-2">
									<For each={taggingCandidates()}>
										{(item) => (
											<label class="flex cursor-pointer items-start gap-3 rounded-xl border p-4">
												<input
													checked={selectedMediaIds().includes(item.id)}
													onChange={() => toggleMediaSelection(item.id)}
													type="checkbox"
												/>
												<div class="grid gap-1">
													<span class="font-medium">{item.title}</span>
													<span class="text-muted-foreground text-sm">
														{item.summary}
													</span>
												</div>
											</label>
										)}
									</For>
								</div>
							</div>

							<div class="grid gap-3 rounded-xl border p-4">
								<div class="flex items-center justify-between">
									<span class="font-medium">Mock job progress</span>
									<span class="text-muted-foreground text-sm">
										{progressValue()}%
									</span>
								</div>
								<Progress value={progressValue()} />
								<div class="flex gap-3">
									<Button disabled={isRunning()} onClick={startBatchTagging}>
										{isRunning() ? "Running..." : "Start Batch Tagging"}
									</Button>
									<Button
										onClick={() => {
											setSelectedMediaIds(
												taggingCandidates().map((item) => item.id),
											);
										}}
										variant="outline"
									>
										Select All
									</Button>
								</div>
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>

			<Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingId() ? "Edit manager item" : "Create manager item"}
						</DialogTitle>
					</DialogHeader>
					<div class="grid gap-4">
						<div class="grid gap-2">
							<Label for="manager-name">Name</Label>
							<Input
								id="manager-name"
								onInput={(event) => setDraftName(event.currentTarget.value)}
								value={draftName()}
							/>
						</div>
						<div class="grid gap-2">
							<Label for="manager-description">Description</Label>
							<Textarea
								id="manager-description"
								onInput={(event) =>
									setDraftDescription(event.currentTarget.value)
								}
								value={draftDescription()}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={closeDialog} variant="outline">
							Cancel
						</Button>
						<Button onClick={saveEntity}>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}

function EntityGrid(props: {
	items: EditableEntity[];
	onEdit: (item: EditableEntity) => void;
	onDelete: (id: string) => void;
}) {
	return (
		<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
			<For each={props.items}>
				{(item) => (
					<Card>
						<CardHeader class="gap-3">
							<div class="flex items-center justify-between gap-3">
								<CardTitle>{item.name}</CardTitle>
								<Badge variant="outline">{item.itemCount}</Badge>
							</div>
							<p class="text-muted-foreground text-sm">{item.description}</p>
						</CardHeader>
						<CardContent class="flex gap-2">
							<Button onClick={() => props.onEdit(item)} variant="outline">
								Edit
							</Button>
							<Button
								onClick={() => props.onDelete(item.id)}
								variant="destructive"
							>
								Delete
							</Button>
						</CardContent>
					</Card>
				)}
			</For>
			<Show when={props.items.length === 0}>
				<Card>
					<CardContent class="py-10 text-center text-muted-foreground">
						No items in this tab.
					</CardContent>
				</Card>
			</Show>
		</div>
	);
}
