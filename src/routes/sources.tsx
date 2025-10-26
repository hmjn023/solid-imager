import { createResource, createSignal, For } from "solid-js";
import { MediaSourceService } from "~/application/services/media-source-service";
import SourceCard from "~/components/source-card";
import SourceDeleteModal from "~/components/source-delete-modal";
import SourceFormModal from "~/components/source-form-modal";

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

  // createResource + fetch を使用したAPIからの実際のデータ
  const [mediaSources, { refetch }] = createResource(
    MediaSourceService.fetchSources
  );

  // APIが失敗した場合、または空を返した場合のモックデータへのフォールバック
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

  // 利用可能な場合は実際のデータを使用し、それ以外の場合はモックデータを使用します。
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
      await MediaSourceService.updateSource(editing.id, sourceData);
    } else {
      await MediaSourceService.createSource(sourceData);
    }
    await refetch();
    setShowFormModal(false);
  };

  const handleDeleteSource = (source) => {
    setDeletingSource(source);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async (sourceId) => {
    await MediaSourceService.deleteSource(sourceId);
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

      {/* ソースグリッド */}
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

      {/* ローディング状態 */}
      {mediaSources.loading && (
        <div class="mt-8 text-center">
          <p class="text-muted-foreground">Loading sources...</p>
        </div>
      )}

      {/* エラー状態 */}
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
