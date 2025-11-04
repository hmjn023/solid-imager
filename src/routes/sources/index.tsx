import { createResource, createSignal, For } from "solid-js";
import { isServer } from "solid-js/web";
import SourceCard from "~/components/source-card";
import SourceDeleteModal from "~/components/source-delete-modal";
import SourceFormModal from "~/components/source-form-modal";

async function fetchSources() {
  const url = "/api/sources";
  const fullUrl = isServer ? `http://localhost:3000${url}` : url;
  const res = await fetch(fullUrl);
  if (!res.ok) {
    throw new Error("Failed to fetch sources");
  }
  return res.json();
}

/**
 * The main component for managing media sources.
 * It displays a list of media sources, and provides functionality to add, edit, and delete them.
 * @returns {JSX.Element} The rendered media sources management page.
 */
export default function Sources() {
  const [showFormModal, setShowFormModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingSource, setEditingSource] = createSignal(null);
  const [deletingSource, setDeletingSource] = createSignal(null);

  const [mediaSources, { refetch }] = createResource(fetchSources);

  const handleAddSource = () => {
    setEditingSource(null);
    setShowFormModal(true);
  };

  const handleEditSource = (source) => {
    setEditingSource(source);
    setShowFormModal(true);
  };

  const handleFormSubmit = async (sourceData) => {
    const editing = editingSource();
    try {
      if (editing) {
        const res = await fetch(`/api/sources/${editing.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sourceData),
        });
        if (!res.ok) {
          throw new Error("Failed to update source");
        }
      } else {
        const res = await fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(sourceData),
        });
        if (!res.ok) {
          throw new Error("Failed to create source");
        }
      }
      await refetch();
      setShowFormModal(false);
    } catch (_error) {
      // You might want to show an error to the user here
    }
  };

  const handleDeleteSource = (source) => {
    setDeletingSource(source);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (mediaSourceId) => {
    try {
      const res = await fetch(`/api/sources/${mediaSourceId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        throw new Error("Failed to delete source");
      }
      await refetch();
      setShowDeleteModal(false);
      setDeletingSource(null);
    } catch (_error) {
      // You might want to show an error to the user here
    }
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
        <For each={mediaSources()}>
          {(source) => (
            <SourceCard
              mediaSource={source}
              onDelete={handleDeleteSource}
              onEdit={handleEditSource}
            />
          )}
        </For>
      </div>

      {mediaSources.loading && (
        <div class="mt-8 text-center">
          <p class="text-muted-foreground">Loading sources...</p>
        </div>
      )}

      {mediaSources.error && (
        <div class="mt-8 text-center">
          <p class="text-red-500">
            Error loading sources: {mediaSources.error.message}
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
