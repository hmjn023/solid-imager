import { useParams } from "@solidjs/router";
import {
  createInfiniteQuery,
  createQuery,
  useQueryClient,
} from "@tanstack/solid-query";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  onMount,
  Show,
} from "solid-js";
import { createStore } from "solid-js/store";
import { isServer, Portal } from "solid-js/web";
import { z } from "zod";
import {
  type SearchFilterState,
  SearchFilters,
} from "~/components/media/search-filters";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { UploadMediaModal } from "~/components/upload-media-modal";
import { getScrollPosition, setScrollPosition } from "~/domain/sources/store";
import type { TagResponse } from "~/domain/tags/schemas";
import { fetchAllCharacters } from "~/infrastructure/api-clients/characters-api";
import { fetchAllIps } from "~/infrastructure/api-clients/ips-api";
import { uploadMedia } from "~/infrastructure/api-clients/media-api";
import { fetchAllProjects } from "~/infrastructure/api-clients/projects-api";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import { fetchTags } from "~/infrastructure/api-clients/tags-api";

const MEDIA_ITEMS_PER_PAGE = 200;
const SCROLL_RESTORE_DELAY = 100;

const buildSearchParams = (state: SearchFilterState, pageParam: number) => ({
  q: state.searchQuery,
  tags:
    state.selectedTags.length > 0 ? state.selectedTags.join(",") : undefined,
  excludeTags:
    state.excludeTags.length > 0 ? state.excludeTags.join(",") : undefined,
  tagMode: state.tagMode,
  projects:
    state.selectedProjects.length > 0
      ? state.selectedProjects.join(",")
      : undefined,
  ips: state.selectedIps.length > 0 ? state.selectedIps.join(",") : undefined,
  characters:
    state.selectedCharacters.length > 0
      ? state.selectedCharacters.join(",")
      : undefined,
  sort: state.sortBy,
  order: state.sortOrder,
  limit: MEDIA_ITEMS_PER_PAGE,
  offset: pageParam,
});

export default function MediaListPage() {
  const params = useParams();
  const queryClient = useQueryClient();

  const mediaSourceId = () => params.mediaSourceId;

  const [localSearchState, setLocalSearchState] =
    createStore<SearchFilterState>({
      searchQuery: "",
      selectedTags: [],
      excludeTags: [],
      tagMode: "and",
      selectedProjects: [],
      selectedIps: [],
      selectedCharacters: [],
      sortBy: "date",
      sortOrder: "desc",
    });

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

  const mediaQuery = createInfiniteQuery(() => ({
    queryKey: ["media", mediaSourceId(), { ...localSearchState }],
    queryFn: ({ pageParam }) => {
      const id = mediaSourceId();
      if (!id) {
        throw new Error("Media source ID is required");
      }
      return searchMedia(
        id,
        buildSearchParams(localSearchState, pageParam as number)
      );
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
  }));

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
      { threshold: 0.5 }
    );

    if (loadMoreRef) {
      observer.observe(loadMoreRef);
    }

    onCleanup(() => observer.disconnect());
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

    await uploadMedia(mediaSourceId() || "", formData);
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
      const json = JSON.parse(text);

      // Send to downloads API
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          mediaSourceId: mediaSourceId() || "",
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
      const eventSource = new EventSource(`/api/sse/${mediaSourceId()}`);

      const invalidateMedia = () => {
        queryClient.invalidateQueries({
          queryKey: ["media", mediaSourceId()],
        });
      };

      // Listen for thumbnail generation completion
      eventSource.addEventListener("thumbnail-generated", (_event) => {
        invalidateMedia();
      });

      // Listen for media files deleted from the directory
      eventSource.addEventListener("media-deleted", (_event) => {
        invalidateMedia();
      });

      // Listen for media files changed in the directory
      eventSource.addEventListener("media-changed", (_event) => {
        // Ideally we might want to update specific item in cache,
        // but invalidating is safer for now
        invalidateMedia();
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
      class="container mx-auto min-h-[calc(100vh-2rem)] p-4"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Show when={!isServer}>
        {/* biome-ignore lint/style/noNonNullAssertion: nav-actions is guaranteed to exist in Nav component */}
        <Portal mount={document.getElementById("nav-actions")!}>
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
              <SearchFilters
                characters={allCharacters.data}
                ips={allIps.data}
                projects={allProjects.data}
                setState={setLocalSearchState}
                state={localSearchState}
                tags={tags.data}
              />
            </DialogContent>
          </Dialog>
        </Portal>
      </Show>

      <div class="mb-4 flex items-center justify-between">
        <h1 class="font-bold text-2xl">Media in Source: {mediaSourceId()}</h1>
      </div>

      <div class="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Sidebar Filters (Desktop only) */}
        <Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
          <CardHeader>
            <CardTitle>検索フィルター</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <SearchFilters
              characters={allCharacters.data}
              ips={allIps.data}
              projects={allProjects.data}
              setState={setLocalSearchState}
              state={localSearchState}
              tags={tags.data}
              usePopover={false}
            />
          </CardContent>
        </Card>

        {/* Media Grid & Content */}
        <div class="flex flex-col gap-4">
          <Show when={mediaQuery.isLoading}>
            <div>Loading media...</div>
          </Show>

          <Show when={mediaQuery.isError}>
            <div class="text-red-500">Error: {mediaQuery.error?.message}</div>
          </Show>

          <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-5">
            <For each={mediaQuery.data?.pages}>
              {(page) => (
                <For each={page.media}>
                  {(item) => (
                    <a href={`${mediaSourceId()}/${item.id}`}>
                      <div class="aspect-square overflow-hidden rounded-lg border">
                        {/* biome-ignore lint/performance/noImgElement: SolidStart does not have a dedicated Image component like Next.js */}
                        <img
                          alt={item.fileName}
                          class="h-full w-full object-cover"
                          height={item.height}
                          loading="lazy"
                          src={`/api/sources/${mediaSourceId()}/${item.id}/thumbnail?t=${new Date(item.modifiedAt).getTime()}`}
                          width={item.width}
                        />
                      </div>
                    </a>
                  )}
                </For>
              )}
            </For>
          </div>

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
