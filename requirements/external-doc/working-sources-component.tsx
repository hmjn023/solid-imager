import { createSignal } from "solid-js";
import { Portal } from "solid-js/web";

export default function Sources() {
  const [showAddModal, setShowAddModal] = createSignal(false);
  const [formName, setFormName] = createSignal("");
  const [formPath, setFormPath] = createSignal("");

  const handleAddSource = () => {
    setShowAddModal(true);
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

      <div class="mt-8 text-center">
        <p class="text-muted-foreground">
          Modal state: {showAddModal().toString()}
        </p>
      </div>

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
                  class="rounded bg-blue-500 px-4 py-2 text-white"
                  onClick={() => {
                    // Reset form
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
