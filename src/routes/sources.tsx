import { createSignal, createResource, For } from "solid-js";
import { Portal } from "solid-js/web";
import SourceCard from "~/components/source-card";

export default function Sources() {
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [formName, setFormName] = createSignal("");
  const [formPath, setFormPath] = createSignal("");
  
  // Fetch function for createResource
  const fetchSources = async () => {
    const response = await fetch('http://localhost:3000/api/sources');
    if (!response.ok) {
      throw new Error('Failed to fetch sources');
    }
    return response.json();
  };

  // Real data from API using createResource + fetch
  const [mediaSources] = createResource(fetchSources);
  
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
    setShowAddModal(true);
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
            <SourceCard mediaSource={source} />
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
        {showAddModal() && (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <h2 class="mb-4 font-bold text-xl">Add Media Source</h2>
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
                  disabled={!(formName().trim() && formPath().trim())}
                  onClick={() => {
                    setFormName("");
                    setFormPath("");
                    setShowAddModal(false);
                  }}
                >
                  Save
                </button>
                <button
                  class="rounded bg-gray-500 px-4 py-2 text-white"
                  onClick={() => setShowAddModal(false)}
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
