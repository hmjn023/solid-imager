import { createResource, createSignal, For } from "solid-js";
import SourceCard from "~/components/source-card";
import SourceDeleteModal from "~/components/source-delete-modal";
import SourceFormModal from "~/components/source-form-modal";
import { sourcesApi } from "~/services/sources";

export default function Sources() {
  const [showFormModal, setShowFormModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingSource, setEditingSource] = createSignal(null);
  const [deletingSource, setDeletingSource] = createSignal(null);

  // Real data from API using createResource + fetch
  const [mediaSources, { refetch }] = createResource(sourcesApi.fetchSources);

  // Fallback to mock data if API fails or returns empty
  const mockSources = [
    {
      id: "1",
      name: "Local Images",
      description: "My local image collection",
      type: "local",
      connectionInfo: { path: "/home/user/images" },
    },
    {
      id: "2",
      name: "Remote Server",
      description: "Images on remote server",
      type: "sftp",
      connectionInfo: { path: "/var/www/images" },
    },
  ];

  // Use real data if available, otherwise use mock data
  const displaySources = () => {
    const realData = mediaSources();
    if (realData && realData.length > 0) {
      return realData;
    }
    return mockSources;
  };

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
    if (editing) {
      await sourcesApi.updateSource(editing.id, sourceData);
    } else {
      await sourcesApi.createSource(sourceData);
    }
    await refetch();
    setShowFormModal(false);
  };

  const handleDeleteSource = (source) => {
    setDeletingSource(source);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (sourceId) => {
    await sourcesApi.deleteSource(sourceId);
    await refetch();
    setShowDeleteModal(false);
    setDeletingSource(null);
  };

  return (
    <div class="container mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="font-bold text-3xl">Media Sources</h1>
        <button
          class="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={handleAddSource}
          type="button"
        >
          Add Source
        </button>
      </div>

      {/* Sources Grid */}
      <div class="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <For each={displaySources()}>
          {(source) => (
            <SourceCard
              mediaSource={source}
              onDelete={handleDeleteSource}
              onEdit={handleEditSource}
            />
          )}
        </For>
      </div>

      {/* Loading State */}
      {mediaSources.loading && (
        <div class="mt-8 text-center">
          <p class="text-muted-foreground">Loading sources...</p>
        </div>
      )}

      {/* Error State */}
      {mediaSources.error && (
        <div class="mt-8 text-center">
          <p class="text-red-500">
            Error loading sources: {mediaSources.error.message}
          </p>
          <p class="text-gray-500 text-sm">Showing mock data instead.</p>
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
