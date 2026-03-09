import type { DownloadItem } from "@solid-imager/core/domain/media/schemas";
import {
  getScrollPosition,
  setScrollPosition,
} from "@solid-imager/core/domain/sources/store";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { Button } from "@solid-imager/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@solid-imager/ui/card";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@solid-imager/ui/context-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@solid-imager/ui/dialog";
import { toast } from "@solid-imager/ui/toast";
import { useParams } from "@solidjs/router";
import {
  createInfiniteQuery,
  createQuery,
  keepPreviousData,
  useQueryClient,
} from "@tanstack/solid-query";
import {
  createEffect,
  createMemo,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { isServer, Portal } from "solid-js/web";
import { z } from "zod";
import { MoveCopyMediaDialog } from "~/components/media/move-copy-media-dialog";
import { SearchControlPanel } from "~/components/media/search-control-panel";
import { SyncMediaDialog } from "~/components/media/sync-media-dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { useCurrentSearchPersistence } from "~/hooks/use-current-search-persistence";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { fetchAllAuthors } from "~/infrastructure/api-clients/authors-api";
import { fetchAllCharacters } from "~/infrastructure/api-clients/characters-api";
import { startDownloadJobs } from "~/infrastructure/api-clients/downloads-api";
import { fetchAllIps } from "~/infrastructure/api-clients/ips-api";
import {
  copyMedia,
  deleteMedia,
  moveMedia,
  syncMediaItems,
  syncMediaToRemote,
  uploadMedia,
} from "~/infrastructure/api-clients/media-api";
import { fetchAllProjects } from "~/infrastructure/api-clients/projects-api";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import {
  fetchSourceDump,
  importSourceZip,
  restoreSource,
} from "~/infrastructure/api-clients/sources-api";
import { fetchTags } from "~/infrastructure/api-clients/tags-api";
import { logger } from "~/infrastructure/logger";
import {
  getSearchCondition,
  searchState,
} from "~/presentation/store/search-store";

const MEDIA_ITEMS_PER_PAGE = 200;
const SCROLL_RESTORE_DELAY = 100;
const DEBOUNCE_DELAY_MS = 1000;

export default function MediaListPage() {
  const params = useParams();
  const queryClient = useQueryClient();

  const mediaSourceId = () => params.mediaSourceId;

  // Enable auto-save/restore of search conditions
  useCurrentSearchPersistence(mediaSourceId);

  // Fetch filter data
  const tags = createQuery<TagResponse[]>(() => ({
    queryKey: ["tags"],
    queryFn: fetchTags,
  }));
  const allProjects = createQuery(() => ({
    queryKey: ["allProjects"],
    queryFn: fetchAllProjects,
  }));
  const allIps = createQuery(() => ({
    queryKey: ["allIps"],
    queryFn: fetchAllIps,
  }));
  const allCharacters = createQuery(() => ({
    queryKey: ["allCharacters"],
    queryFn: fetchAllCharacters,
  }));
  const allAuthors = createQuery(() => ({
    queryKey: ["allAuthors"],
    queryFn: fetchAllAuthors,
  }));

  // Optimize query key to only include relevant search parameters.
  // Serialize condition as JSON string to stabilize the key across mode toggles
  // (simple/pro produce structurally-equivalent but referentially-different objects).
  const searchConditionKey = createMemo(() =>
    JSON.stringify(getSearchCondition() ?? null)
  );

  const searchParams = createMemo(() => ({
    condition: getSearchCondition(),
    sort: searchState.sortBy,
    order: searchState.sortOrder,
  }));

  const mediaQuery = createInfiniteQuery(() => ({
    queryKey: [
      "media",
      mediaSourceId(),
      searchConditionKey(),
      searchState.sortBy,
      searchState.sortOrder,
    ],
    queryFn: ({ pageParam }) => {
      const id = mediaSourceId();
      if (!id) {
        throw new Error("Media source ID is required");
      }
      return searchMedia(id, {
        ...searchParams(),
        limit: MEDIA_ITEMS_PER_PAGE,
        offset: pageParam as number,
      });
    },
    initialPageParam: 0,
    getNextPageParam: (lastPage, allPages) => {
      const loadedCount = allPages.reduce(
        (sum, page) => sum + page.media.length,
        0
      );
      if (loadedCount < lastPage.total) {
        return loadedCount;
      }
      return;
    },
    placeholderData: keepPreviousData,
  }));

  const handleSearch = () => {
    window.scrollTo(0, 0);
  };

  // Disable browser's default scroll restoration
  onMount(() => {
    if (isServer) {
      return;
    }
    if ("scrollRestoration" in history) {
      history.scrollRestoration = "manual";
    }
  });

  // Scroll restoration logic - runs only once when data is first loaded
  const [isScrollRestored, setIsScrollRestored] = createSignal(false);

  createEffect(() => {
    if (isServer) {
      return;
    }
    if (isScrollRestored()) {
      return;
    }

    const id = mediaSourceId();
    if (!id) {
      return;
    }

    // Only restore scroll if we have data and it's not loading
    if (mediaQuery.data && !mediaQuery.isLoading) {
      const targetScrollY = getScrollPosition(id);

      if (targetScrollY > 0) {
        // Simple restoration attempt
        setTimeout(() => {
          requestAnimationFrame(() => {
            window.scrollTo(0, targetScrollY);
            setIsScrollRestored(true);
          });
        }, SCROLL_RESTORE_DELAY);
      } else {
        setIsScrollRestored(true);
      }
    }
  });

  onCleanup(() => {
    if (isServer) {
      return;
    }
    const id = mediaSourceId();
    if (id) {
      setScrollPosition(id, window.scrollY);
    }
  });

  // Infinite scroll trigger
  let loadMoreRef: HTMLDivElement | undefined;

  onMount(() => {
    if (isServer) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && mediaQuery.hasNextPage) {
          mediaQuery.fetchNextPage();
        }
      },
      { threshold: 0.5, rootMargin: "1000px" }
    );

    if (loadMoreRef) {
      observer.observe(loadMoreRef);
    }

    onCleanup(() => observer.disconnect());
  });

  const [showUploadModal, setShowUploadModal] = createSignal(false);
  const [fileToUpload, setFileToUpload] = createSignal<File | null>(null);
  const [pastedUrl, setPastedUrl] = createSignal<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = createSignal(false);
  const [mediaIdToDelete, setMediaIdToDelete] = createSignal<string | null>(
    null
  );

  // Copy/Move Dialog State
  const [moveCopyDialogOpen, setMoveCopyDialogOpen] = createSignal(false);
  const [moveCopyMode, setMoveCopyMode] = createSignal<"copy" | "move">("copy");
  const [mediaIdToMoveCopy, setMediaIdToMoveCopy] = createSignal<string | null>(
    null
  );

  // Sync Remote Dialog State
  const [syncRemoteDialogOpen, setSyncRemoteDialogOpen] = createSignal(false);
  const [mediaIdToSyncRemote, setMediaIdToSyncRemote] = createSignal<
    string | null
  >(null);

  // Singleton Context Menu State
  const [contextMenuMediaId, setContextMenuMediaId] = createSignal<
    string | null
  >(null);

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
    await uploadMedia(mediaSourceId() || "", options.file, {
      filename: options.filename,
      description: options.description,
      sourceUrl: options.sourceUrl,
      overwrite: options.overwrite,
      autoIncrement: options.autoIncrement,
    });
    toast.success("Media uploaded successfully");
    // Invalidate query to refetch list
    queryClient.invalidateQueries({
      queryKey: ["media", mediaSourceId()],
    });
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
      const jsonContent = JSON.parse(text);
      let items: DownloadItem[] = [];

      // Case 1: JSON is a direct array of DownloadItem
      if (Array.isArray(jsonContent)) {
        items = jsonContent;
      }
      // Case 2: JSON is an object with an 'items' key (previous handling)
      else if (jsonContent.items && Array.isArray(jsonContent.items)) {
        items = jsonContent.items;
      }
      // Case 3: JSON is an object with an 'images' key (new handling for user's provided structure)
      else if (jsonContent.images && Array.isArray(jsonContent.images)) {
        items = jsonContent.images
          .map(
            // biome-ignore lint/suspicious/noExplicitAny: Dynamic JSON structure, any is acceptable here.
            (image: any) => {
              const imageUrl = image.originalUrl || image.displayUrl;
              if (!imageUrl) {
                return null; // Skip if no valid URL is found
              }

              let tweetUrl: string | undefined;
              if (image.source === "twitter" && image.metadata?.postId) {
                tweetUrl = `https://twitter.com/i/web/status/${image.metadata.postId}`;
              }

              return {
                imageUrl,
                tweetUrl,
                tweetText: image.metadata?.title,
                authorName: image.metadata?.author,
                timestamp: image.metadata?.timestamp || image.date, // Assuming 'date' can be a fallback for timestamp
                // Add other fields as needed from the provided JSON structure to match DownloadItem
              };
            }
          )
          .filter(Boolean) as DownloadItem[]; // Filter out nulls
      } else {
        throw new Error(
          "JSONファイルはアイテムの配列であるか、'items'または'images'キーを含むオブジェクトである必要があります。"
        );
      }

      if (items.length === 0) {
        throw new Error(
          "JSONファイルにはダウンロードするアイテムが含まれていません。"
        );
      }

      // Send to downloads API
      await startDownloadJobs(mediaSourceId() || "", items);

      toast.success("Bulk download started");
      // Refetch will happen via SSE events
    } catch (error) {
      logger.error({ err: error }, "Failed to process JSON upload");
      toast.error(`Failed to start download: ${(error as Error).message}`);
    }
  };

  const handleDumpDownload = async (mode: "json" | "zip" = "json") => {
    const id = mediaSourceId();
    if (!id) {
      return;
    }

    try {
      const blob = await fetchSourceDump(id, mode);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `source-${id}-dump.${mode}`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(`Dump (${mode.toUpperCase()}) downloaded successfully`);
    } catch (error) {
      logger.error(
        { err: error, mediaSourceId: id, mode },
        "Failed to download dump"
      );
      toast.error("Failed to download dump");
    }
  };

  const handleRestoreSelect = async (e: Event) => {
    const target = e.target as HTMLInputElement;
    if (!target.files || target.files.length === 0) {
      return;
    }

    const file = target.files[0];
    const id = mediaSourceId();
    if (!id) {
      return;
    }

    try {
      // Check for ZIP file
      if (
        file.name.endsWith(".zip") ||
        file.type === "application/zip" ||
        file.type === "application/x-zip-compressed"
      ) {
        toast.loading("Importing ZIP dump...", { id: "restore-toast" });
        const result = await importSourceZip(id, file);
        toast.success(
          `Import complete: ${result.importedCount} items imported.`,
          { id: "restore-toast" }
        );
        queryClient.invalidateQueries({
          queryKey: ["media", id],
        });
        target.value = ""; // Reset input
        return;
      }

      // Default to JSON handling
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const json = JSON.parse(event.target?.result as string);

          toast.loading("Restoring metadata...", { id: "restore-toast" });

          const result = await restoreSource(id, json);

          toast.success(
            `Restore complete: ${result.processed} processed, ${result.skipped} skipped`,
            { id: "restore-toast" }
          );

          // Refresh view
          queryClient.invalidateQueries({
            queryKey: ["media", id],
          });
        } catch (error) {
          logger.error({ err: error }, "Restore from JSON failed");
          toast.error(`Restore failed: ${(error as Error).message}`, {
            id: "restore-toast",
          });
        } finally {
          target.value = ""; // Reset input
        }
      };
      reader.readAsText(file);
    } catch (error) {
      logger.error({ err: error }, "Import failed");
      toast.error(`Import failed: ${(error as Error).message}`, {
        id: "restore-toast",
      });
      target.value = "";
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

  const handleDelete = (mediaId: string) => {
    setMediaIdToDelete(mediaId);
    setDeleteDialogOpen(true);
  };

  const _confirmDelete = async () => {
    const id = mediaIdToDelete();
    if (!id) {
      return;
    }

    try {
      await deleteMedia(mediaSourceId() || "", id);
      toast.success("Media deleted successfully");
      await mediaQuery.refetch();
    } catch (e) {
      logger.error({ err: e, mediaId: id }, "Failed to delete media");
      toast.error("Failed to delete media");
    } finally {
      setDeleteDialogOpen(false);
      setMediaIdToDelete(null);
    }
  };

  const handleCopyMove = (mediaId: string, mode: "copy" | "move") => {
    setMediaIdToMoveCopy(mediaId);
    setMoveCopyMode(mode);
    setMoveCopyDialogOpen(true);
  };

  const handleSyncRemote = (mediaId: string) => {
    setMediaIdToSyncRemote(mediaId);
    setSyncRemoteDialogOpen(true);
  };

  const handleConfirmCopyMove = async (targetSourceId: string) => {
    const id = mediaIdToMoveCopy();
    const sourceId = mediaSourceId();
    if (!(id && sourceId)) {
      return;
    }

    const mode = moveCopyMode();
    const action = mode === "copy" ? copyMedia : moveMedia;
    const actionName = mode === "copy" ? "copied" : "moved";

    try {
      await action(sourceId, id, targetSourceId);
      toast.success(`Media ${actionName} successfully`);
      await mediaQuery.refetch();
      // Invalidate target source cache to ensure fresh data when navigating
      if (sourceId !== targetSourceId) {
        await queryClient.invalidateQueries({
          queryKey: ["media", targetSourceId],
        });
      }
    } catch (e) {
      logger.error(
        { err: e, mediaId: id, targetSourceId, mode },
        `Failed to ${mode} media`
      );
      toast.error(`Failed to ${mode} media: ${(e as Error).message}`);
    } finally {
      setMediaIdToMoveCopy(null);
    }
  };

  const handleConfirmSyncRemote = async (
    targetServerId: string,
    targetSourceId: string
  ) => {
    const id = mediaIdToSyncRemote();
    const sourceId = mediaSourceId();
    if (!(id && sourceId)) {
      return;
    }

    toast.loading("Syncing to remote server...", { id: "sync-remote" });
    try {
      await syncMediaToRemote(sourceId, id, targetServerId, targetSourceId);
      toast.success("Media synced to remote successfully", {
        id: "sync-remote",
      });
    } catch (e) {
      logger.error(
        { err: e, mediaId: id, targetServerId },
        "Failed to sync to remote"
      );
      toast.error(`Failed to sync to remote: ${(e as Error).message}`, {
        id: "sync-remote",
      });
    } finally {
      setMediaIdToSyncRemote(null);
    }
  };

  const [isSyncingMedia, setIsSyncingMedia] = createSignal(false);

  const handleSyncLoadedMedia = async () => {
    const allPages = mediaQuery.data?.pages;
    if (!allPages) {
      return;
    }
    const mediaIds = allPages
      .flatMap((page) => page.media)
      .map((m) => m?.id)
      .filter(Boolean) as string[];

    if (mediaIds.length === 0 || isSyncingMedia()) {
      return;
    }

    setIsSyncingMedia(true);
    toast("Starting batch sync for loaded media...");
    try {
      await syncMediaItems(mediaSourceId() || "", mediaIds);
      toast.success(`Batch sync completed for ${mediaIds.length} items`);
      await mediaQuery.refetch();
    } catch (error) {
      logger.error({ err: error }, "Failed to batch sync media");
      toast.error(`Failed to batch sync: ${(error as Error).message}`);
    } finally {
      setIsSyncingMedia(false);
    }
  };

  const handleSyncSingleMedia = async (mediaId: string) => {
    toast("Starting metadata sync...");
    try {
      await syncMediaItems(mediaSourceId() || "", [mediaId]);
      toast.success("Metadata synced successfully");
      await mediaQuery.refetch();
    } catch (e) {
      logger.error({ err: e, mediaId }, "Failed to sync metadata");
      toast.error(`Failed to sync metadata: ${(e as Error).message}`);
    }
  };

  const [addedCount, setAddedCount] = createSignal(0);
  const [debounceTimer, setDebounceTimer] = createSignal<ReturnType<
    typeof setTimeout
  > | null>(null);

  onCleanup(() => {
    const timer = debounceTimer();
    if (timer) {
      clearTimeout(timer);
    }
  });

  useMediaSourceEvents(mediaSourceId, {
    onMediaAdded: () => {
      setAddedCount((prev) => prev + 1);

      const timer = debounceTimer();
      if (timer) {
        clearTimeout(timer);
      }

      setDebounceTimer(
        setTimeout(() => {
          const count = addedCount();
          if (count > 0) {
            toast.success(`${count} new media detected. Refreshing list...`);
            setAddedCount(0);
          }
          queryClient.invalidateQueries({
            queryKey: ["media", mediaSourceId()],
          });
        }, DEBOUNCE_DELAY_MS)
      );
    },
    onMediaDeleted: () => {
      toast.success("Media deleted");
      queryClient.invalidateQueries({
        queryKey: ["media", mediaSourceId()],
      });
    },
    onThumbnailGenerated: () => {
      toast.success("Thumbnail generated");
      queryClient.invalidateQueries({
        queryKey: ["media", mediaSourceId()],
      });
    },
    onMediaCopied: () => {
      queryClient.invalidateQueries({
        queryKey: ["media", mediaSourceId()],
      });
    },
    onMediaMoved: () => {
      queryClient.invalidateQueries({
        queryKey: ["media", mediaSourceId()],
      });
    },
    onMediaChanged: () => {
      queryClient.invalidateQueries({
        queryKey: ["media", mediaSourceId()],
      });
    },
    onAllJobsCompleted: (data) => {
      toast.success(
        `All jobs completed! Processed: ${data.processed ?? "N/A"}`
      );
      queryClient.invalidateQueries({
        queryKey: ["media", mediaSourceId()],
      });
    },
    onWatcherError: (data) => {
      toast.error(`Watcher Error: ${data.error || "Unknown error"}`);
    },
  });

  onMount(() => {
    if (!isServer) {
      document.addEventListener("paste", handlePaste);

      onCleanup(() => {
        document.removeEventListener("paste", handlePaste);
      });
    }
  });

  return (
    /* biome-ignore lint/a11y/noNoninteractiveElementInteractions: This section is a drop zone, and the event handlers are necessary for its functionality. */
    <section
      aria-label="Media upload area"
      class="container mx-auto min-h-[calc(100vh-2rem)] p-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Show when={!isServer}>
        {/* biome-ignore lint/style/noNonNullAssertion: nav-actions is guaranteed to exist in Nav component */}
        <Portal mount={document.getElementById("nav-actions")!}>
          <Button
            class="mr-2 border-white text-white hover:bg-sky-700"
            onClick={() => handleDumpDownload("json")}
            size="icon"
            title="Download Backup JSON"
            variant="outline"
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: Download icon */}
            <svg
              class="lucide lucide-file-json"
              fill="none"
              height="20"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              viewBox="0 0 24 24"
              width="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z" />
              <path d="M14 2v4a2 2 0 0 0 2 2h4" />
              <path d="M10 12a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1" />
              <path d="M10 18a1 1 0 0 0-1-1v-1a1 1 0 0 0 1-1" />
            </svg>
          </Button>
          <Button
            class="mr-2 border-white text-white hover:bg-sky-700"
            onClick={() => handleDumpDownload("zip")}
            size="icon"
            title="Download Backup ZIP (with Images)"
            variant="outline"
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: Download ZIP icon */}
            <svg
              class="lucide lucide-archive"
              fill="none"
              height="20"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              viewBox="0 0 24 24"
              width="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect height="5" rx="1" width="20" x="2" y="3" />
              <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
              <path d="M10 12h4" />
            </svg>
          </Button>
          <Button
            class="mr-2 border-white text-white hover:bg-sky-700"
            onClick={() => document.getElementById("restore-input")?.click()}
            size="icon"
            title="Restore Metadata from Dump"
            variant="outline"
          >
            {/* biome-ignore lint/a11y/noSvgWithoutTitle: Upload Cloud icon */}
            <svg
              class="lucide lucide-upload-cloud"
              fill="none"
              height="20"
              stroke="currentColor"
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              viewBox="0 0 24 24"
              width="20"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
              <path d="M12 12v9" />
              <path d="m16 16-4-4-4 4" />
            </svg>
          </Button>
          <Dialog>
            <DialogTrigger
              as={Button}
              class="border-white text-white hover:bg-sky-700 md:hidden"
              size="icon"
              variant="outline"
            >
              {/* biome-ignore lint/a11y/noSvgWithoutTitle: Filter icon */}
              <svg
                class="lucide lucide-filter"
                fill="none"
                height="24"
                stroke="currentColor"
                stroke-linecap="round"
                stroke-linejoin="round"
                stroke-width="2"
                viewBox="0 0 24 24"
                width="24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </DialogTrigger>
            <DialogContent class="max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>検索フィルター</DialogTitle>
              </DialogHeader>
              <div class="space-y-4">
                <SearchControlPanel
                  class="w-full"
                  context="source"
                  filterData={{
                    tags: tags.data,
                    projects: allProjects.data,
                    ips: allIps.data,
                    characters: allCharacters.data,
                    authors: allAuthors.data,
                  }}
                  onSearch={handleSearch}
                />
              </div>
            </DialogContent>
          </Dialog>
        </Portal>
      </Show>

      <div class="mb-4 flex items-center justify-between">
        <h1 class="font-bold text-2xl">Media in Source: {mediaSourceId()}</h1>
        <Button
          disabled={isSyncingMedia() || !mediaQuery.data?.pages.length}
          onClick={handleSyncLoadedMedia}
          variant="outline"
        >
          {isSyncingMedia() ? "Syncing..." : "Sync Loaded Media"}
        </Button>
      </div>

      <div class="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Sidebar Filters (Desktop only) */}
        <Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
          <CardHeader>
            <CardTitle>検索フィルター</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            {/* Mode Switcher & Presets */}
            <SearchControlPanel
              class="w-full"
              context="source"
              filterData={{
                tags: tags.data,
                projects: allProjects.data,
                ips: allIps.data,
                characters: allCharacters.data,
                authors: allAuthors.data,
              }}
              onSearch={handleSearch}
              usePopover={false}
            />
          </CardContent>
        </Card>

        {/* Media Grid & Content */}
        <div class="flex flex-col gap-4">
          <Show when={mediaQuery.isPending && !mediaQuery.data}>
            <div class="flex h-64 items-center justify-center">
              <div class="animate-pulse text-lg text-muted-foreground">
                Loading media...
              </div>
            </div>
          </Show>

          <Show when={mediaQuery.isError}>
            <div class="text-red-500">Error: {mediaQuery.error?.message}</div>
          </Show>

          {/* Global Context Menu for the Grid */}
          {/* Global Context Menu for the Grid */}
          <ContextMenu>
            <ContextMenuTrigger class="h-full w-full">
              <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
                <For each={mediaQuery.data?.pages}>
                  {(page) => (
                    <For each={page.media}>
                      {(item) => {
                        if (!item) {
                          return null;
                        }

                        return (
                          <a
                            class="relative block aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 transition-all hover:shadow-md"
                            data-media-id={item.id}
                            href={`/sources/${mediaSourceId()}/${item.id}`} // Link to detail page
                            onContextMenu={() => setContextMenuMediaId(item.id)}
                          >
                            {/* biome-ignore lint/performance/noImgElement: No optimized Image component available */}
                            <img
                              alt={item.fileName}
                              class="h-full w-full object-cover"
                              height={item.height}
                              loading="lazy"
                              src={`/api/sources/${mediaSourceId()}/${item.id}/thumbnail?t=${new Date(
                                item.modifiedAt
                              ).getTime()}`}
                              width={item.width}
                            />
                          </a>
                        );
                      }}
                    </For>
                  )}
                </For>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <Show
                fallback={
                  <ContextMenuItem disabled>No media selected</ContextMenuItem>
                }
                when={contextMenuMediaId()}
              >
                <ContextMenuItem
                  onSelect={() => {
                    const id = contextMenuMediaId();
                    if (id) {
                      window.open(
                        `/sources/${mediaSourceId()}/${id}`,
                        "_blank"
                      );
                    }
                  }}
                >
                  Open in New Tab
                </ContextMenuItem>
                <ContextMenuItem
                  class="text-red-600 focus:text-red-600"
                  onSelect={() => {
                    const id = contextMenuMediaId();
                    if (id) {
                      handleDelete(id);
                    }
                  }}
                >
                  Delete
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    const id = contextMenuMediaId();
                    if (id) {
                      handleCopyMove(id, "copy");
                    }
                  }}
                >
                  Copy to Source
                </ContextMenuItem>
                <ContextMenuItem
                  onSelect={() => {
                    const id = contextMenuMediaId();
                    if (id) {
                      handleCopyMove(id, "move");
                    }
                  }}
                >
                  Move to Source
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    const id = contextMenuMediaId();
                    if (id) {
                      handleSyncSingleMedia(id);
                    }
                  }}
                >
                  Sync Metadata (Reprocess)
                </ContextMenuItem>
                <ContextMenuSeparator />
                <ContextMenuItem
                  onSelect={() => {
                    const id = contextMenuMediaId();
                    if (id) {
                      handleSyncRemote(id);
                    }
                  }}
                >
                  Sync to Remote Server
                </ContextMenuItem>
              </Show>
            </ContextMenuContent>
          </ContextMenu>

          {/* Infinite scroll trigger */}
          <div
            class="h-10 w-full"
            ref={(el) => {
              loadMoreRef = el;
            }}
          >
            <Show when={mediaQuery.isFetchingNextPage}>
              <div class="text-center text-gray-500">Loading more...</div>
            </Show>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        accept=".json,.zip"
        class="hidden"
        id="restore-input"
        onChange={handleRestoreSelect}
        type="file"
      />
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
      <Dialog onOpenChange={setDeleteDialogOpen} open={deleteDialogOpen()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Media</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this media? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => setDeleteDialogOpen(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button onClick={_confirmDelete} variant="destructive">
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MoveCopyMediaDialog
        currentSourceId={mediaSourceId() || ""}
        mode={moveCopyMode()}
        onConfirm={handleConfirmCopyMove}
        onOpenChange={setMoveCopyDialogOpen}
        open={moveCopyDialogOpen()}
      />

      <SyncMediaDialog
        onConfirm={handleConfirmSyncRemote}
        onOpenChange={setSyncRemoteDialogOpen}
        open={syncRemoteDialogOpen()}
      />
    </section>
  );
}
