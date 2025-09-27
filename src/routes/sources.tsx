import { createSignal, createResource, For } from "solid-js";
import SourceCard from "~/components/source-card";
import SourceFormModal from "~/components/source-form-modal";
import SourceDeleteModal from "~/components/source-delete-modal";
import type { MediaSourceTypeEnum } from "~/lib/types";

export default function Sources() {
  const [showFormModal, setShowFormModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingSource, setEditingSource] = createSignal(null);
  const [deletingSource, setDeletingSource] = createSignal(null);
  
  // Fetch function for createResource
  const fetchSources = async () => {
    const response = await fetch('http://localhost:3000/api/sources');
    if (!response.ok) {
      throw new Error('Failed to fetch sources');
    }
    return response.json();
  };

  // Create new source function
  const createSource = async (sourceData) => {
    const response = await fetch('http://localhost:3000/api/sources', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sourceData),
    });
    if (!response.ok) {
      throw new Error('Failed to create source');
    }
    return response.json();
  };

  // Update source function
  const updateSource = async (sourceId, sourceData) => {
    const response = await fetch(`http://localhost:3000/api/sources/${sourceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(sourceData),
    });
    if (!response.ok) {
      throw new Error('Failed to update source');
    }
    return response.json();
  };

  // Delete source function
  const deleteSource = async (sourceId) => {
    const response = await fetch(`http://localhost:3000/api/sources/${sourceId}`, {
      method: 'DELETE',
    });
    if (!response.ok) {
      throw new Error('Failed to delete source');
    }
    return response.json();
  };

  // Real data from API using createResource + fetch
  const [mediaSources, { refetch }] = createResource(fetchSources);
  
  // Fallback to mock data if API fails or returns empty
  const mockSources = [
    {
      id: "1",
      name: "Local Images",
      description: "My local image collection",
      type: "local",
      connectionInfo: { path: "/home/user/images" }
    },
    {
      id: "2", 
      name: "Remote Server",
      description: "Images on remote server",
      type: "sftp",
      connectionInfo: { path: "/var/www/images" }
    }
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
      await updateSource(editing.id, sourceData);
    } else {
      await createSource(sourceData);
    }
    await refetch();
    setShowFormModal(false);
  };

  const handleDeleteSource = (source) => {
    setDeletingSource(source);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (sourceId) => {
    await deleteSource(sourceId);
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
              onEdit={handleEditSource}
              onDelete={handleDeleteSource}
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
          <p class="text-red-500">Error loading sources: {mediaSources.error.message}</p>
          <p class="text-sm text-gray-500">Showing mock data instead.</p>
        </div>
      )}

      <SourceFormModal
        isOpen={showFormModal()}
        editingSource={editingSource()}
        onClose={() => setShowFormModal(false)}
        onSubmit={handleFormSubmit}
      />

      <SourceDeleteModal
        isOpen={showDeleteModal()}
        sourceToDelete={deletingSource()}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDeleteConfirm}
      />
    </div>
  );
}
