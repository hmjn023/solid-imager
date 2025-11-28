import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createSignal, For } from "solid-js";
import SourceCard from "~/components/source-card";
import SourceDeleteModal from "~/components/source-delete-modal";
import SourceFormModal from "~/components/source-form-modal";
import type { MediaSourceInfo } from "~/domain/sources/schemas";
import {
  createMediaSource,
  deleteMediaSource,
  fetchMediaSources,
  updateMediaSource,
} from "~/infrastructure/api-clients/sources-api";

/**
 * The main component for managing media sources.
 * It displays a list of media sources, and provides functionality to add, edit, and delete them.
 * @returns {JSX.Element} The rendered media sources management page.
 */
export default function Sources() {
  const [showFormModal, setShowFormModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingSource, setEditingSource] =
    createSignal<MediaSourceInfo | null>(null);
  const [deletingSource, setDeletingSource] =
    createSignal<MediaSourceInfo | null>(null);

  const queryClient = useQueryClient();
  const mediaSources = createQuery(() => ({
    queryKey: ["mediaSources"],
    queryFn: fetchMediaSources,
  }));

  const handleAddSource = () => {
    setEditingSource(null);
    setShowFormModal(true);
  };

  const handleEditSource = (source: MediaSourceInfo) => {
    setEditingSource(source);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (sourceData: unknown) => {
    const editing = editingSource();
    try {
      if (editing?.id) {
        await updateMediaSource(editing.id, sourceData);
      } else {
        await createMediaSource(sourceData);
      }
      await queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
      setShowFormModal(false);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Error already logged by API client
    } catch (_error) {}
  };

  const handleDeleteSource = (source: MediaSourceInfo) => {
    setDeletingSource(source);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (mediaSourceId: string) => {
    try {
      await deleteMediaSource(mediaSourceId);
      await queryClient.invalidateQueries({ queryKey: ["mediaSources"] });
      setShowDeleteModal(false);
      setDeletingSource(null);
      // biome-ignore lint/suspicious/noEmptyBlockStatements: Error already logged by API client
    } catch (_error) {}
  };

  return (
    <div class="container mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="font-bold text-3xl">Media Sources</h1>
        <button
          class="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={() => handleAddSource()}
          type="button"
        >
          Add Source
        </button>
      </div>

      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <For each={mediaSources.data}>
          {(source) => (
            <SourceCard
              mediaSource={source}
              onDelete={handleDeleteSource}
              onEdit={handleEditSource}
            />
          )}
        </For>
      </div>

      {mediaSources.isLoading && (
        <div class="mt-8 text-center">
          <p class="text-muted-foreground">Loading sources...</p>
        </div>
      )}

      {mediaSources.isError && (
        <div class="mt-8 text-center">
          <p class="text-red-500">
            Error loading sources: {mediaSources.error?.message}
          </p>
        </div>
      )}

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
