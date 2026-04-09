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
import { Textarea } from "@solid-imager/ui/textarea";
import { toast } from "@solid-imager/ui/toast";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { createSignal, For } from "solid-js";
import { type MockSource, mockSources } from "../../mocks/demo-data";

export const Route = createFileRoute("/sources/")({
	component: SourcesRoute,
});

function SourcesRoute() {
	const [sources, setSources] = createSignal(
		mockSources.map((item) => ({ ...item })),
	);
	const [isDialogOpen, setIsDialogOpen] = createSignal(false);
	const [editingId, setEditingId] = createSignal<string | null>(null);
	const [draftName, setDraftName] = createSignal("");
	const [draftPath, setDraftPath] = createSignal("");
	const [draftDescription, setDraftDescription] = createSignal("");

	const openCreate = () => {
		setEditingId(null);
		setDraftName("");
		setDraftPath("");
		setDraftDescription("");
		setIsDialogOpen(true);
	};

	const openEdit = (source: MockSource) => {
		setEditingId(source.id);
		setDraftName(source.name);
		setDraftPath(source.path);
		setDraftDescription(source.description);
		setIsDialogOpen(true);
	};

	const saveSource = () => {
		const payload: MockSource = {
			id: editingId() ?? `source-${Date.now()}`,
			name: draftName() || "Untitled Source",
			path: draftPath() || "/mnt/media/new-source",
			description: draftDescription() || "Added from the Tauri mock page.",
			type: "folder",
			status: "idle",
			lastSync: "just now",
			mediaCount: 0,
			accent: "linear-gradient(135deg, #164e63, #38bdf8)",
		};

		setSources((items) =>
			editingId()
				? items.map((item) => (item.id === payload.id ? payload : item))
				: [payload, ...items],
		);
		setIsDialogOpen(false);
		toast.success(`${editingId() ? "Updated" : "Created"} source card`);
	};

	const deleteSource = (sourceId: string) => {
		setSources((items) => items.filter((item) => item.id !== sourceId));
		toast.success("Deleted source card");
	};

	const syncSource = (source: MockSource) => {
		toast.success(`Mock sync started for ${source.name}`);
	};

	const syncAll = () => {
		toast.success(`Mock sync started for ${sources().length} sources`);
	};

	return (
		<section class="grid gap-6">
			<div class="flex items-center justify-between gap-4">
				<div class="grid gap-2">
					<h1 class="font-semibold text-4xl tracking-tight">Media Sources</h1>
					<p class="text-muted-foreground">
						Source card, dialog, sync action, and detail route transitions are
						available here with mock state only.
					</p>
				</div>
				<div class="flex gap-2">
					<Button onClick={syncAll} variant="outline">
						Sync All
					</Button>
					<Button onClick={openCreate}>Add Source</Button>
				</div>
			</div>

			<div class="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
				<For each={sources()}>
					{(source) => (
						<Card class="overflow-hidden">
							<div class="h-28 w-full" style={{ background: source.accent }} />
							<CardHeader class="gap-3">
								<div class="flex items-center justify-between gap-3">
									<CardTitle>{source.name}</CardTitle>
									<Badge
										variant={
											source.status === "attention"
												? "destructive"
												: source.status === "watching"
													? "secondary"
													: "outline"
										}
									>
										{source.status}
									</Badge>
								</div>
								<p class="text-muted-foreground text-sm">
									{source.description}
								</p>
							</CardHeader>
							<CardContent class="grid gap-4">
								<div class="grid gap-1 text-muted-foreground text-sm">
									<span>{source.path}</span>
									<span>
										{source.mediaCount} items · last sync {source.lastSync}
									</span>
								</div>
								<div class="flex flex-wrap gap-2">
									<Link
										class="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90"
										params={{ mediaSourceId: source.id }}
										to="/sources/$mediaSourceId"
									>
										Open
									</Link>
									<Button onClick={() => syncSource(source)} variant="outline">
										Sync
									</Button>
									<Button onClick={() => openEdit(source)} variant="outline">
										Edit
									</Button>
									<Button
										onClick={() => deleteSource(source.id)}
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

			<Dialog onOpenChange={setIsDialogOpen} open={isDialogOpen()}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							{editingId() ? "Edit source" : "Create source"}
						</DialogTitle>
					</DialogHeader>
					<div class="grid gap-4">
						<div class="grid gap-2">
							<Label for="source-name">Name</Label>
							<Input
								id="source-name"
								onInput={(event) => setDraftName(event.currentTarget.value)}
								value={draftName()}
							/>
						</div>
						<div class="grid gap-2">
							<Label for="source-path">Path</Label>
							<Input
								id="source-path"
								onInput={(event) => setDraftPath(event.currentTarget.value)}
								value={draftPath()}
							/>
						</div>
						<div class="grid gap-2">
							<Label for="source-description">Description</Label>
							<Textarea
								id="source-description"
								onInput={(event) =>
									setDraftDescription(event.currentTarget.value)
								}
								value={draftDescription()}
							/>
						</div>
					</div>
					<DialogFooter>
						<Button onClick={() => setIsDialogOpen(false)} variant="outline">
							Cancel
						</Button>
						<Button onClick={saveSource}>Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</section>
	);
}
