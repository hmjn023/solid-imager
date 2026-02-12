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
        <h1 class="font-bold text-3xl">メディアソース</h1>
        <button
          class="rounded bg-blue-500 px-4 py-2 text-white"
          onClick={handleAddSource}
          type="button"
        >
          ソースを追加
        </button>
      </div>

      <div class="mt-8 text-center">
        <p class="text-muted-foreground">
          モーダルの状態: {showAddModal().toString()}
        </p>
      </div>

      <Portal>
        {showAddModal() && (
          <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div class="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-lg">
              <h2 class="mb-4 font-bold text-xl">メディアソースを追加</h2>
              <div class="mb-4 space-y-4">
                <div>
                  <label class="mb-1 block font-medium text-sm">
                    名前
                    <input
                      class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                      onInput={(e) => setFormName(e.currentTarget.value)}
                      placeholder="ソース名を入力してください"
                      type="text"
                      value={formName()}
                    />
                  </label>
                </div>
                <div>
                  <label class="mb-1 block font-medium text-sm">
                    パス
                    <input
                      class="mt-1 w-full rounded-md border border-gray-300 px-3 py-2"
                      onInput={(e) => setFormPath(e.currentTarget.value)}
                      placeholder="ファイルパスを入力してください"
                      type="text"
                      value={formPath()}
                    />
                  </label>
                </div>
              </div>
              <div class="flex gap-2">
                <button
                  class="rounded bg-blue-500 px-4 py-2 text-white"
                  onClick={() => {
                    // フォームをリセット
                    setFormName("");
                    setFormPath("");
                    setShowAddModal(false);
                  }}
                  type="button"
                >
                  保存
                </button>
                <button
                  class="rounded bg-gray-500 px-4 py-2 text-white"
                  onClick={() => setShowAddModal(false)}
                  type="button"
                >
                  キャンセル
                </button>
              </div>
            </div>
          </div>
        )}
      </Portal>
    </div>
  );
}
