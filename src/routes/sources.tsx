import {
	createQuery,
	createMutation,
	useQueryClient,
} from "@tanstack/solid-query";
import { createSignal, For, Match, Show, Switch } from "solid-js";
import MediaSourceModal from "../components/MediaSourceModal";
import SourceCard from "../components/sourceCard";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Button } from "../components/ui/button";
import type { MediaSource } from "../db/schema";
import type { mediaSourceInfo } from "../lib/types";

export default function Sources() {
	const [isModalOpen, setIsModalOpen] = createSignal(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [modalMode, setModalMode] = createSignal<"add" | "edit">("add");
	const [selectedSource, setSelectedSource] = createSignal<
		MediaSource | undefined
	>();

	const queryClient = useQueryClient();

	const mediaSources = createQuery(() => ({
		queryKey: ["mediaSources"],
		queryFn: async () => {
			const response = await fetch("http://localhost:3000/api/sources/");
			return (await response.json()) as MediaSource[];
		},
	}));

	const addSourceMutation = createMutation(() => ({
		mutationFn: async (newData: mediaSourceInfo) => {
			const response = await fetch("http://localhost:3000/api/sources/", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(newData),
			});
			if (!response.ok) {
				throw new Error("Failed to create media source");
			}
			return await response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
			closeModal();
		},
	}));

	const updateSourceMutation = createMutation(() => ({
		mutationFn: async (updatedData: MediaSource) => {
			const response = await fetch(
				`http://localhost:3000/api/sources/${updatedData.id}`,
				{
					method: "PUT",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify(updatedData),
				},
			);
			if (!response.ok) {
				throw new Error("Failed to update media source");
			}
			return await response.json();
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
			closeModal();
		},
	}));

	const openAddModal = () => {
		setModalMode("add");
		setSelectedSource(undefined);
		setIsModalOpen(true);
	};

	const openEditModal = (source: MediaSource) => {
		setModalMode("edit");
		setSelectedSource(source);
		setIsModalOpen(true);
	};

	const closeModal = () => {
		setIsModalOpen(false);
	};

	const deleteSourceMutation = createMutation(() => ({
		mutationFn: async (sourceId: string) => {
			const response = await fetch(
				`http://localhost:3000/api/sources/${sourceId}`,
				{
					method: "DELETE",
				},
			);
			if (!response.ok) {
				throw new Error("Failed to delete media source");
			}
		},
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
			setIsDeleteDialogOpen(false);
		},
	}));

	const handleSubmit = (data: mediaSourceInfo) => {
		if (modalMode() === "add") {
			addSourceMutation.mutate(data);
		} else {
			updateSourceMutation.mutate({ ...selectedSource(), ...data });
		}
	};

	const handleDelete = (source: MediaSource) => {
		setSelectedSource(source);
		setIsDeleteDialogOpen(true);
	};

	const confirmDelete = () => {
		if (selectedSource()) {
			deleteSourceMutation.mutate(selectedSource()!.id);
		}
	};

	return (
		<main class="text-center mx-auto text-gray-700 p-4">
			<div class="flex justify-between items-center mb-4">
				<h1 class="text-3xl font-bold">Media Sources</h1>
				<Button onClick={openAddModal}>Add Source</Button>
			</div>
			<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
				<Switch>
					<Match when={mediaSources.isPending}>Loading...</Match>
					<Match when={mediaSources.isError}>
						Error: {mediaSources.error?.message}
					</Match>
					<Match when={mediaSources.isSuccess}>
						<For each={mediaSources.data}>
							{(source) => (
								<SourceCard
									mediaSource={source}
									onEdit={openEditModal}
									onDelete={handleDelete}
								/>
							)}
						</For>
					</Match>
				</Switch>
			</div>

			<Show when={isModalOpen()}>
				<MediaSourceModal
					isOpen={isModalOpen()}
					onClose={closeModal}
					onSubmit={handleSubmit}
					initialData={selectedSource()}
					title={modalMode() === "add" ? "Add Media Source" : "Edit Media Source"}
					description={
						modalMode() === "add"
							? "Add a new media source to your library."
							: "Edit the details of your media source."
					}
				/>
			</Show>

			<AlertDialog
				open={isDeleteDialogOpen()}
				onOpenChange={setIsDeleteDialogOpen}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the media
							source "{selectedSource()?.name}".
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction onClick={confirmDelete}>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}
