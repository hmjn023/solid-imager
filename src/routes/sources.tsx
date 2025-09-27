import { createSignal, createResource, For } from "solid-js";
import { Portal } from "solid-js/web";
import SourceCard from "~/components/source-card";
import type { MediaSourceTypeEnum } from "~/lib/types";

export default function Sources() {
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [showEditModal, setShowEditModal] = createSignal(false);
  const [showDeleteModal, setShowDeleteModal] = createSignal(false);
  const [editingSource, setEditingSource] = createSignal(null);
  const [deletingSource, setDeletingSource] = createSignal(null);
  const [formName, setFormName] = createSignal("");
  const [formPath, setFormPath] = createSignal("");
  const [formDescription, setFormDescription] = createSignal("");
  const [formType, setFormType] = createSignal<MediaSourceTypeEnum>("local");
  const [isSubmitting, setIsSubmitting] = createSignal(false);
  const [isDeleting, setIsDeleting] = createSignal(false);
  
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
    // Reset form
    setFormName("");
    setFormPath("");
    setFormDescription("");
    setFormType("local");
    setEditingSource(null);
    setShowAddModal(true);
  };

  const handleEditSource = (source) => {
    // Pre-fill form with existing data
    setFormName(source.name);
    setFormDescription(source.description || "");
    setFormType(source.type);
    setFormPath(
      typeof source.connectionInfo === "object" &&
      source.connectionInfo !== null &&
      "path" in source.connectionInfo
        ? String(source.connectionInfo.path)
        : ""
    );
    setEditingSource(source);
    setShowEditModal(true);
  };

  const handleFormSubmit = async () => {
    if (!formName().trim() || !formPath().trim()) {
      return;
    }

    setIsSubmitting(true);
    try {
      const sourceData = {
        name: formName(),
        description: formDescription() || null,
        type: formType(),
        connectionInfo: { path: formPath() }
      };

      const editing = editingSource();
      if (editing) {
        await updateSource(editing.id, sourceData);
        console.log("Source updated successfully!");
      } else {
        await createSource(sourceData);
        console.log("Source created successfully!");
      }
      
      // Reset form and close modal
      setFormName("");
      setFormPath("");
      setFormDescription("");
      setFormType("local");
      setEditingSource(null);
      setShowAddModal(false);
      setShowEditModal(false);
      
      // Refresh the source list
      await refetch();
    } catch (error) {
      console.error("Failed to create source:", error);
      alert("Failed to create source: " + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteSource = (source) => {
    setDeletingSource(source);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    const source = deletingSource();
    if (!source) return;

    setIsDeleting(true);
    try {
      await deleteSource(source.id);
      
      setShowDeleteModal(false);
      setDeletingSource(null);
      
      // Refresh the source list
      await refetch();
      
      console.log("Source deleted successfully!");
    } catch (error) {
      console.error("Failed to delete source:", error);
      alert("Failed to delete source: " + error.message);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div class="container mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="font-bold text-3xl">Media Sources</h1>
        <button
          class="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={() => {
            console.log("Add Source button clicked");
            handleAddSource();
            console.log("Modal state:", showAddModal());
          }}
          type="button"
        >
          Add Source
        </button>
      </div>

      {/* Debug info */}
      <div class="mb-4 bg-gray-100 p-2 text-xs">
        Debug: AddModal={showAddModal().toString()}
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

      <Portal>
        {(showAddModal() || showEditModal()) && (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <h2 class="mb-4 font-bold text-xl">
                {editingSource() ? "Edit Media Source" : "Add Media Source"}
              </h2>
              <div class="mb-4 space-y-4">
                <div>
                  <label class="mb-1 block font-medium text-sm">Name</label>
                  <input
                    class="w-full rounded-md border border-gray-300 px-3 py-2"
                    onInput={(e) => setFormName(e.currentTarget.value)}
                    placeholder="Enter source name"
                    type="text"
                    value={formName()}
                  />
                </div>
                <div>
                  <label class="mb-1 block font-medium text-sm">Description</label>
                  <input
                    class="w-full rounded-md border border-gray-300 px-3 py-2"
                    onInput={(e) => setFormDescription(e.currentTarget.value)}
                    placeholder="Enter description (optional)"
                    type="text"
                    value={formDescription()}
                  />
                </div>
                <div>
                  <label class="mb-1 block font-medium text-sm">Type</label>
                  <select
                    class="w-full rounded-md border border-gray-300 px-3 py-2"
                    onChange={(e) => setFormType(e.currentTarget.value as MediaSourceTypeEnum)}
                    value={formType()}
                  >
                    <option value="local">Local</option>
                    <option value="sftp">SFTP</option>
                    <option value="s3">S3</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1 block font-medium text-sm">Path</label>
                  <input
                    class="w-full rounded-md border border-gray-300 px-3 py-2"
                    onInput={(e) => setFormPath(e.currentTarget.value)}
                    placeholder="Enter file path"
                    type="text"
                    value={formPath()}
                  />
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  class="rounded bg-blue-500 px-4 py-2 text-white disabled:opacity-50"
                  disabled={!(formName().trim() && formPath().trim()) || isSubmitting()}
                  onClick={handleFormSubmit}
                >
                  {isSubmitting() ? "Saving..." : editingSource() ? "Update" : "Create"}
                </button>
                <button
                  class="rounded bg-gray-500 px-4 py-2 text-white"
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal() && (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <h2 class="mb-4 font-bold text-xl">Delete Media Source</h2>
              <p class="mb-4">
                Are you sure you want to delete "{deletingSource()?.name}"? 
                This action cannot be undone and will remove all associated media files from the database.
              </p>
              <div class="flex gap-2">
                <button
                  class="rounded bg-red-500 px-4 py-2 text-white disabled:opacity-50"
                  disabled={isDeleting()}
                  onClick={handleDeleteConfirm}
                >
                  {isDeleting() ? "Deleting..." : "Delete"}
                </button>
                <button
                  class="rounded bg-gray-500 px-4 py-2 text-white"
                  onClick={() => setShowDeleteModal(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </Portal>
    </div>
  );
}
