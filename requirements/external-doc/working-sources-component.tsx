import { createSignal } from "solid-js";
import { Portal } from "solid-js/web";

export default function Sources() {
  console.log("Sources component rendered");

  const [showAddModal, setShowAddModal] = createSignal(false);
  const [formName, setFormName] = createSignal("");
  const [formPath, setFormPath] = createSignal("");

  const handleAddSource = () => {
    console.log("Add source button clicked");
    setShowAddModal(true);
    console.log("showAddModal set to:", showAddModal());
  };

  return (
    <div class="container mx-auto p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-3xl font-bold">Media Sources</h1>
        <button
          onClick={handleAddSource}
          type="button"
          class="px-4 py-2 bg-blue-500 text-white rounded"
        >
          Add Source
        </button>
      </div>

      <div class="mt-8 text-center">
        <p class="text-muted-foreground">
          Modal state: {showAddModal().toString()}
        </p>
      </div>

      <Portal>
        {showAddModal() && (
          <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-lg max-w-md w-full mx-4">
              <h2 class="text-xl font-bold mb-4">Add Media Source</h2>
              <div class="space-y-4 mb-4">
                <div>
                  <label class="block text-sm font-medium mb-1">Name</label>
                  <input
                    type="text"
                    placeholder="Enter source name"
                    value={formName()}
                    onInput={(e) => setFormName(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Path</label>
                  <input
                    type="text"
                    placeholder="Enter file path"
                    value={formPath()}
                    onInput={(e) => setFormPath(e.currentTarget.value)}
                    class="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  onClick={() => {
                    console.log("Save clicked with data:", {
                      name: formName(),
                      path: formPath(),
                      type: "local",
                      connectionInfo: { path: formPath() }
                    });
                    // Reset form
                    setFormName("");
                    setFormPath("");
                    setShowAddModal(false);
                  }}
                  class="px-4 py-2 bg-blue-500 text-white rounded"
                >
                  Save
                </button>
                <button
                  onClick={() => setShowAddModal(false)}
                  class="px-4 py-2 bg-gray-500 text-white rounded"
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