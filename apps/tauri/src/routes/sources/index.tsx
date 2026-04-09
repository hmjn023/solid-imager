import { toast } from "@solid-imager/ui/toast";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, For } from "solid-js";
import { SourceCard } from "../../components/source-card";
import { SourceDeleteModal } from "../../components/source-delete-modal";
import { SourceFormModal } from "../../components/source-form-modal";
import type { MockSource } from "../../mocks/demo-data";
import { mockSources } from "../../mocks/demo-data";

export const Route = createFileRoute("/sources/")({
	component: SourcesRoute,
});

function SourcesRoute() {
	const [sources, setSources] = createSignal(
		mockSources.map((source) => ({ ...source })),
	);
	const [showFormModal, setShowFormModal] = createSignal(false);
	const [showDeleteModal, setShowDeleteModal] = createSignal(false);
	const [editingSource, setEditingSource] = createSignal<MockSource | null>(
		null,
	);
	const [deletingSource, setDeletingSource] = createSignal<MockSource | null>(
		null,
	);
	const [isSyncing, setIsSyncing] = createSignal(false);

	const handleAddSource = () => {
		setEditingSource(null);
		setShowFormModal(true);
	};

	const handleEditSource = (source: MockSource) => {
		setEditingSource(source);
		setShowFormModal(true);
	};

	const handleFormSubmit = (sourceData: {
		connectionInfo: MockSource["connectionInfo"];
		description: string | null;
		name: string;
		type: MockSource["type"];
	}) => {
		if (editingSource()?.id) {
			setSources((items) =>
				items.map((item) =>
					item.id === editingSource()?.id
						? {
								...item,
								...sourceData,
							}
						: item,
				),
			);
			toast.success("Source updated");
		} else {
			setSources((items) => [
				{
					...sourceData,
					id: `source-${Date.now()}`,
					lastSync: "just now",
					mediaCount: 0,
					status: "idle",
				},
				...items,
			]);
			toast.success("Source created");
		}
		setShowFormModal(false);
	};

	const handleDeleteSource = (source: MockSource) => {
		setDeletingSource(source);
		setShowDeleteModal(true);
	};

	const handleDeleteConfirm = (sourceId: string) => {
		setSources((items) => items.filter((item) => item.id !== sourceId));
		setShowDeleteModal(false);
		setDeletingSource(null);
		toast.success("Source deleted");
	};

	const handleSyncSource = (source: MockSource) => {
		if (isSyncing()) {
			return;
		}
		setIsSyncing(true);
		toast.info(`Starting sync for ${source.name}...`);
		window.setTimeout(() => {
			setIsSyncing(false);
			toast.success(`Sync finished for ${source.name}`);
		}, 600);
	};

	const handleSyncAll = () => {
		if (isSyncing() || sources().length === 0) {
			return;
		}
		setIsSyncing(true);
		toast.info("Starting sync for all sources...");
		window.setTimeout(() => {
			setIsSyncing(false);
			toast.success("Sync finished for all sources");
		}, 700);
	};

	return (
		<div class="container mx-auto p-6">
			<div class="mb-6 flex items-center justify-between">
				<h1 class="font-bold text-3xl">Media Sources</h1>
				<div class="flex items-center gap-2">
					<button
						class="rounded bg-green-500 px-4 py-2 text-white shadow hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
						disabled={isSyncing() || sources().length === 0}
						onClick={handleSyncAll}
						type="button"
					>
						{isSyncing() ? "Syncing..." : "Sync All"}
					</button>
					<button
						class="rounded bg-blue-500 px-4 py-2 text-white shadow hover:bg-blue-600"
						onClick={handleAddSource}
						type="button"
					>
						Add Source
					</button>
				</div>
			</div>

			<div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
				<For each={sources()}>
					{(source) => (
						<SourceCard
							mediaSource={source}
							onDelete={handleDeleteSource}
							onEdit={handleEditSource}
							onSync={handleSyncSource}
						/>
					)}
				</For>
			</div>

			<SourceFormModal
				editingSource={editingSource()}
				isOpen={showFormModal()}
				onClose={() => setShowFormModal(false)}
				onSubmit={handleFormSubmit}
			/>
			<SourceDeleteModal
				isOpen={showDeleteModal()}
				onClose={() => setShowDeleteModal(false)}
				onConfirm={handleDeleteConfirm}
				sourceToDelete={deletingSource()}
			/>
		</div>
	);
}
