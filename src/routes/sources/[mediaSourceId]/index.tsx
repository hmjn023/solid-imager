import { useParams } from "@solidjs/router";
import {
  createEffect,
  createResource,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import { z } from "zod";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { getScrollPosition, setScrollPosition } from "~/domain/sources/store";
import {
  fetchMediaList,
  uploadMedia,
} from "~/infrastructure/api-clients/media-api";

/**
 * 特定のメディアソース内のメディアをグリッド表示するページコンポーネントです。
 */
export default function MediaListPage() {
  const params = useParams();
  const [media, { refetch }] = createResource(
    () => params.mediaSourceId,
    fetchMediaList
  );

  const [isRestored, setIsRestored] = createSignal(false);

  createEffect(() => {
    if (!(media.loading || isRestored())) {
      const scrollY = getScrollPosition(params.mediaSourceId);
      if (scrollY > 0) {
        window.scrollTo(0, scrollY);
      }
      setIsRestored(true);
    }
  });

  onCleanup(() => {
    setScrollPosition(params.mediaSourceId, window.scrollY);
  });

  const [showUploadModal, setShowUploadModal] = createSignal(false);
  const [fileToUpload, setFileToUpload] = createSignal<File | null>(null);
  const [pastedUrl, setPastedUrl] = createSignal<string | null>(null);

  let fileInputRef: HTMLInputElement | undefined;

  type UploadOptions = {
    file: File;
    filename: string;
    description: string;
    sourceUrl?: string;
    overwrite: boolean;
    autoIncrement: boolean;
  };

  const handleUpload = async (options: UploadOptions) => {
    const formData = new FormData();
    formData.append("file", options.file);
    formData.append("filename", options.filename);
    formData.append("description", options.description);
    if (options.sourceUrl) {
      formData.append("sourceUrl", options.sourceUrl);
    }
    formData.append("overwrite", String(options.overwrite));
    formData.append("autoIncrement", String(options.autoIncrement));

    await uploadMedia(params.mediaSourceId, formData);
    refetch(); // Re-fetch media list after successful upload
  };

  const handleFileSelect = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];

      // Check if it's a JSON file
      if (file.type === "application/json" || file.name.endsWith(".json")) {
        await handleJsonFileUpload(file);
      } else {
        // Normal image file upload
        setFileToUpload(file);
        setShowUploadModal(true);
      }

      // Reset file input
      target.value = "";
    }
  };

  const handleJsonFileUpload = async (file: File) => {
    try {
      const text = await file.text();
      const json = JSON.parse(text);

      // Send to downloads API
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaSourceId: params.mediaSourceId,
          items: json,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to start download jobs");
      }

      // Refetch will happen via SSE events
    } catch (_error) {
      // TODO: Replace with proper UI notification
    }
  };

  const handleAddButtonClick = () => {
    fileInputRef?.click();
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

  const handleImagePasteItem = (
    item: DataTransferItem,
    e: ClipboardEvent
  ): boolean => {
    if (item.type.indexOf("image") !== -1) {
      const blob = item.getAsFile();

      if (blob) {
        const file = new File([blob], `pasted-image-${Date.now()}.png`, {
          type: blob.type,
        });
        setFileToUpload(file);
        setShowUploadModal(true);
        e.preventDefault();

        return true;
      }
    }

    return false;
  };

  const handleUrlPasteItem = async (
    item: DataTransferItem,
    e: ClipboardEvent
  ): Promise<boolean> => {
    if (item.type === "text/plain") {
      const text = await new Promise<string | null>((resolve) => {
        item.getAsString((str) => resolve(str));
      });

      if (text && z.string().url().safeParse(text).success) {
        setPastedUrl(text);
        setShowUploadModal(true);
        e.preventDefault();
        return true;
      }
    }
    return false;
  };

  const processClipboardItems = async (
    items: DataTransferItemList,
    e: ClipboardEvent
  ): Promise<boolean> => {
    for (const item of items) {
      if (handleImagePasteItem(item, e)) {
        return true;
      }
    }

    for (const item of items) {
      if (await handleUrlPasteItem(item, e)) {
        return true;
      }
    }

    return false;
  };

  const handlePaste = async (e: ClipboardEvent) => {
    if (!e.clipboardData?.items) {
      return;
    }
    await processClipboardItems(e.clipboardData.items, e);
  };

  onMount(() => {
    if (!isServer) {
      document.addEventListener("paste", handlePaste);

      // SSE Subscription for real-time updates
      const eventSource = new EventSource(`/api/sse/${params.mediaSourceId}`);

      // Listen for thumbnail generation completion
      // This is the main event that triggers UI updates for new media
      eventSource.addEventListener("thumbnail-generated", (_event) => {
        refetch();
      });

      // Listen for new media files added to the directory
      // Note: We don't refetch here because thumbnails aren't ready yet
      // The thumbnail-generated event will trigger the refetch
      eventSource.addEventListener("media-added", (_event) => {
        // Thumbnail generation is queued, will refetch when thumbnail-generated fires
      });

      // Listen for media files deleted from the directory
      eventSource.addEventListener("media-deleted", (_event) => {
        refetch();
      });

      // Listen for media files changed in the directory
      eventSource.addEventListener("media-changed", (_event) => {
        // Thumbnail regeneration is queued, will refetch when thumbnail-generated fires
      });

      eventSource.onerror = (_err) => {
        eventSource.close();
      };

      onCleanup(() => {
        document.removeEventListener("paste", handlePaste);
        eventSource.close();
      });
    }
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
                  loading="lazy"
                  src={`/api/sources/${params.mediaSourceId}/${item.id}/thumbnail?t=${new Date(item.modifiedAt).getTime()}`}
                  width={item.width}
                />
              </div>
            </a>
          )}
        </For>
      </div>

      {/* Hidden file input */}
      <input
        accept="image/*,.json"
        class="hidden"
        onChange={handleFileSelect}
        ref={(el) => {
          fileInputRef = el;
        }}
        type="file"
      />

      {/* Floating add button */}
      <button
        aria-label="Add media"
        class="fixed right-8 bottom-8 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"
        onClick={handleAddButtonClick}
        type="button"
      >
        <span class="text-3xl leading-none">＋</span>
      </button>

      <UploadMediaModal
        initialFile={fileToUpload()}
        isOpen={showUploadModal()}
        onClose={() => {
          setShowUploadModal(false);
          setPastedUrl(null);
          setFileToUpload(null);
        }}
        onUpload={handleUpload}
        onUrlFetch={(file) => setFileToUpload(file)}
        pastedUrl={pastedUrl()}
      />
    </section>
  );
}
