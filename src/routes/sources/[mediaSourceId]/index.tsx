import { useParams } from "@solidjs/router";
import {
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import { UploadMediaModal } from "~/components/upload-media-modal";

// APIから返されるメディアオブジェクトの型を定義します。
// これはDBスキーマと一致することが期待されます。
type Media = {
  id: string;
  fileName: string;
  width: number;
  height: number;
  // 必要に応じて他のプロパティを追加します。
};

/**
 * 指定されたソースIDのメディアリストをAPIから非同期に取得します。
 * @param sourceId メディアを取得するソースのID。
 * @returns メディアの配列を解決するPromise。
 */
async function fetchMedia(sourceId: string): Promise<Media[]> {
  const url = `/api/sources/${sourceId}`;
  const fullUrl = isServer ? `http://localhost:3000${url}` : url;
  const response = await fetch(fullUrl);
  if (!response.ok) {
    // TODO: エラーハンドリングを改善する
    throw new Error("メディアの取得に失敗しました");
  }
  return response.json();
}

/**
 * 特定のメディアソース内のメディアをグリッド表示するページコンポーネントです。
 */
export default function MediaListPage() {
  const params = useParams();
  const [media, { refetch }] = createResource(
    () => params.mediaSourceId,
    fetchMedia
  );

  const [showUploadModal, setShowUploadModal] = createSignal(false);
  const [fileToUpload, setFileToUpload] = createSignal<File | null>(null);

  type UploadOptions = {
    file: File;
    filename: string;
    description: string;
    sourceUrl: string;
    overwrite: boolean;
    autoIncrement: boolean;
  };

  const handleUpload = async (options: UploadOptions) => {
    const formData = new FormData();
    formData.append("file", options.file);
    formData.append("filename", options.filename);
    formData.append("description", options.description);
    formData.append("sourceUrl", options.sourceUrl);
    formData.append("overwrite", String(options.overwrite));
    formData.append("autoIncrement", String(options.autoIncrement));

    const url = `/api/sources/${params.mediaSourceId}`;
    const response = await fetch(url, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || "メディアのアップロードに失敗しました。"
      );
    }

    refetch(); // Re-fetch media list after successful upload
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
      const file = e.dataTransfer.files[0];
      setFileToUpload(file);
      setShowUploadModal(true);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handlePaste = (e: ClipboardEvent) => {
    if (e.clipboardData?.items) {
      for (const item of e.clipboardData.items) {
        if (item.type.indexOf("image") !== -1) {
          const blob = item.getAsFile();
          if (blob) {
            const file = new File([blob], `pasted-image-${Date.now()}.png`, {
              type: blob.type,
            });
            setFileToUpload(file);
            setShowUploadModal(true);
            e.preventDefault();
            break;
          }
        }
      }
    }
  };

  onMount(() => {
    document.addEventListener("paste", handlePaste);
  });

  onCleanup(() => {
    document.removeEventListener("paste", handlePaste);
  });

  return (
    /* biome-ignore lint/a11y/noNoninteractiveElementInteractions: This section is a drop zone, and the event handlers are necessary for its functionality. */
    <section
      aria-label="Media upload area"
      class="container mx-auto min-h-[calc(100vh-2rem)] rounded-lg border-2 border-gray-300 border-dashed p-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h1 class="mb-4 font-bold text-2xl">
        Media in Source: {params.mediaSourceId}
      </h1>

      <Show when={media.loading}>
        <div>Loading media...</div>
      </Show>

      <Show when={media.error}>
        <div class="text-red-500">Error: {media.error.message}</div>
      </Show>

      <div class="grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-6">
        <For each={media()}>
          {(item) => (
            <a href={`${params.mediaSourceId}/${item.id}`}>
              <div class="aspect-square overflow-hidden rounded-lg border">
                {/* biome-ignore lint/performance/noImgElement: SolidStart does not have a dedicated Image component like Next.js */}
                <img
                  alt={item.fileName}
                  class="h-full w-full object-cover"
                  height={item.height}
                  src={`/api/sources/${params.mediaSourceId}/${item.id}/thumbnail`}
                  width={item.width}
                />
              </div>
            </a>
          )}
        </For>
      </div>

      <UploadMediaModal
        initialFile={fileToUpload()}
        isOpen={showUploadModal()}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
      />
    </section>
  );
}
