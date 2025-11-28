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
import { isServer } from "solid-js/web";
import { z } from "zod";
import { Badge } from "~/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "~/components/ui/command";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
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

type LocalSearchState = {
  searchQuery: string;
  selectedTags: string[];
  excludeTags: string[];
  tagMode: "and" | "or";
  selectedProjects: number[];
  selectedIps: number[];
  selectedCharacters: number[];
  sortBy: "date" | "name" | "size";
  sortOrder: "asc" | "desc";
};

const buildSearchParams = (state: LocalSearchState, pageParam: number) => ({
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

  const [localSearchState, setLocalSearchState] = createStore<LocalSearchState>(
    {
      searchQuery: "",
      selectedTags: [],
      excludeTags: [],
      tagMode: "and",
      selectedProjects: [],
      selectedIps: [],
      selectedCharacters: [],
      sortBy: "date",
      sortOrder: "desc",
    }
  );

  const [_commandOpen, setCommandOpen] = createSignal(false);
  const [_excludeCommandOpen, setExcludeCommandOpen] = createSignal(false);

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

  // Helper functions for filters
  const addTag = (tagName: string) => {
    if (!localSearchState.selectedTags.includes(tagName)) {
      setLocalSearchState("selectedTags", [
        ...localSearchState.selectedTags,
        tagName,
      ]);
    }
    setCommandOpen(false);
  };

  const removeTag = (tagName: string) => {
    setLocalSearchState(
      "selectedTags",
      localSearchState.selectedTags.filter((t) => t !== tagName)
    );
  };

  const addExcludeTag = (tagName: string) => {
    if (!localSearchState.excludeTags.includes(tagName)) {
      setLocalSearchState("excludeTags", [
        ...localSearchState.excludeTags,
        tagName,
      ]);
    }
    setExcludeCommandOpen(false);
  };

  const removeExcludeTag = (tagName: string) => {
    setLocalSearchState(
      "excludeTags",
      localSearchState.excludeTags.filter((t) => t !== tagName)
    );
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
      <h1 class="mb-4 font-bold text-2xl">
        Media in Source: {mediaSourceId()}
      </h1>

      <div class="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Sidebar Filters */}
        <Card>
          <CardHeader>
            <CardTitle>検索フィルター</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            {/* Filename Search */}
            <div class="space-y-2">
              <Label>ファイル名検索</Label>
              <Input
                onInput={(e) =>
                  setLocalSearchState("searchQuery", e.currentTarget.value)
                }
                placeholder="ファイル名を入力..."
                type="text"
                value={localSearchState.searchQuery}
              />
            </div>

            {/* Tag Selection with Command */}
            <div class="space-y-2">
              <Label>タグ (含む)</Label>
              <div class="mb-2 flex flex-wrap gap-2">
                <For each={localSearchState.selectedTags}>
                  {(tag) => (
                    <Badge class="cursor-pointer" variant="default">
                      {tag}
                      <button
                        class="ml-1 hover:text-red-500"
                        onClick={() => removeTag(tag)}
                        type="button"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </For>
              </div>
              <Command class="rounded-md border">
                <CommandInput placeholder="タグを検索..." />
                <CommandList>
                  <CommandEmpty>タグが見つかりません</CommandEmpty>
                  <CommandGroup>
                    <For each={tags.data}>
                      {(tag) => (
                        <CommandItem
                          class="cursor-pointer"
                          onSelect={() => addTag(tag.name)}
                        >
                          {tag.name}
                        </CommandItem>
                      )}
                    </For>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {/* Tag Mode */}
            <div class="space-y-2">
              <Label>タグマッチモード</Label>
              <Select
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {props.item.rawValue === "and"
                      ? "すべて含む (AND)"
                      : "いずれかを含む (OR)"}
                  </SelectItem>
                )}
                onChange={(value) =>
                  setLocalSearchState("tagMode", value || "and")
                }
                options={["and", "or"]}
                placeholder="モードを選択"
                value={localSearchState.tagMode}
              >
                <SelectTrigger>
                  <SelectValue<string>>
                    {(state) =>
                      state.selectedOption() === "and"
                        ? "すべて含む (AND)"
                        : "いずれかを含む (OR)"
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>

            {/* Exclude Tags */}
            <div class="space-y-2">
              <Label>除外タグ</Label>
              <div class="mb-2 flex flex-wrap gap-2">
                <For each={localSearchState.excludeTags}>
                  {(tag) => (
                    <Badge class="cursor-pointer" variant="destructive">
                      {tag}
                      <button
                        class="ml-1 hover:text-white"
                        onClick={() => removeExcludeTag(tag)}
                        type="button"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </For>
              </div>
              <Command class="rounded-md border">
                <CommandInput placeholder="除外タグを検索..." />
                <CommandList>
                  <CommandEmpty>タグが見つかりません</CommandEmpty>
                  <CommandGroup>
                    <For each={tags.data}>
                      {(tag) => (
                        <CommandItem
                          class="cursor-pointer"
                          onSelect={() => addExcludeTag(tag.name)}
                        >
                          {tag.name}
                        </CommandItem>
                      )}
                    </For>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {/* Project Filter */}
            <div class="space-y-2">
              <Label>プロジェクト</Label>
              <div class="mb-2 flex flex-wrap gap-2">
                <For each={localSearchState.selectedProjects}>
                  {(projectId) => {
                    const project = allProjects.data?.find(
                      (p) => p.id === projectId
                    );
                    return (
                      <Badge class="cursor-pointer" variant="secondary">
                        {project?.name || projectId}
                        <button
                          class="ml-1 hover:text-red-500"
                          onClick={() =>
                            setLocalSearchState(
                              "selectedProjects",
                              localSearchState.selectedProjects.filter(
                                (id) => id !== projectId
                              )
                            )
                          }
                          type="button"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  }}
                </For>
              </div>
              <Command class="rounded-md border">
                <CommandInput placeholder="プロジェクトを検索..." />
                <CommandList>
                  <CommandEmpty>プロジェクトが見つかりません</CommandEmpty>
                  <CommandGroup>
                    <For each={allProjects.data}>
                      {(project) => (
                        <CommandItem
                          class="cursor-pointer"
                          onSelect={() => {
                            if (
                              !localSearchState.selectedProjects.includes(
                                project.id
                              )
                            ) {
                              setLocalSearchState("selectedProjects", [
                                ...localSearchState.selectedProjects,
                                project.id,
                              ]);
                            }
                          }}
                        >
                          <div class="flex flex-col">
                            <span>{project.name}</span>
                            <Show when={project.description}>
                              <span class="text-muted-foreground text-xs">
                                {project.description}
                              </span>
                            </Show>
                          </div>
                        </CommandItem>
                      )}
                    </For>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {/* IP Filter */}
            <div class="space-y-2">
              <Label>IP</Label>
              <div class="mb-2 flex flex-wrap gap-2">
                <For each={localSearchState.selectedIps}>
                  {(ipId) => {
                    const ip = allIps.data?.find((i) => i.id === ipId);
                    return (
                      <Badge class="cursor-pointer" variant="secondary">
                        {ip?.name || ipId}
                        <button
                          class="ml-1 hover:text-red-500"
                          onClick={() =>
                            setLocalSearchState(
                              "selectedIps",
                              localSearchState.selectedIps.filter(
                                (id) => id !== ipId
                              )
                            )
                          }
                          type="button"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  }}
                </For>
              </div>
              <Command class="rounded-md border">
                <CommandInput placeholder="IPを検索..." />
                <CommandList>
                  <CommandEmpty>IPが見つかりません</CommandEmpty>
                  <CommandGroup>
                    <For each={allIps.data}>
                      {(ip) => (
                        <CommandItem
                          class="cursor-pointer"
                          onSelect={() => {
                            if (!localSearchState.selectedIps.includes(ip.id)) {
                              setLocalSearchState("selectedIps", [
                                ...localSearchState.selectedIps,
                                ip.id,
                              ]);
                            }
                          }}
                        >
                          <div class="flex flex-col">
                            <span>{ip.name}</span>
                            <Show when={ip.description}>
                              <span class="text-muted-foreground text-xs">
                                {ip.description}
                              </span>
                            </Show>
                          </div>
                        </CommandItem>
                      )}
                    </For>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {/* Character Filter */}
            <div class="space-y-2">
              <Label>キャラクター</Label>
              <div class="mb-2 flex flex-wrap gap-2">
                <For each={localSearchState.selectedCharacters}>
                  {(characterId) => {
                    const character = allCharacters.data?.find(
                      (c) => c.id === characterId
                    );
                    return (
                      <Badge class="cursor-pointer" variant="secondary">
                        {character?.name || characterId}
                        <button
                          class="ml-1 hover:text-red-500"
                          onClick={() =>
                            setLocalSearchState(
                              "selectedCharacters",
                              localSearchState.selectedCharacters.filter(
                                (id) => id !== characterId
                              )
                            )
                          }
                          type="button"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  }}
                </For>
              </div>
              <Command class="rounded-md border">
                <CommandInput placeholder="キャラクターを検索..." />
                <CommandList>
                  <CommandEmpty>キャラクターが見つかりません</CommandEmpty>
                  <CommandGroup>
                    <For each={allCharacters.data}>
                      {(character) => (
                        <CommandItem
                          class="cursor-pointer"
                          onSelect={() => {
                            if (
                              !localSearchState.selectedCharacters.includes(
                                character.id
                              )
                            ) {
                              setLocalSearchState("selectedCharacters", [
                                ...localSearchState.selectedCharacters,
                                character.id,
                              ]);
                            }
                          }}
                        >
                          <div class="flex flex-col">
                            <span>{character.name}</span>
                            <Show when={character.description}>
                              <span class="text-muted-foreground text-xs">
                                {character.description}
                              </span>
                            </Show>
                          </div>
                        </CommandItem>
                      )}
                    </For>
                  </CommandGroup>
                </CommandList>
              </Command>
            </div>

            {/* Sort Options */}
            <div class="space-y-2">
              <Label>ソート</Label>
              <div class="grid grid-cols-2 gap-2">
                <Select
                  itemComponent={(props) => {
                    const getSortLabel = (value: string) => {
                      if (value === "date") {
                        return "作成日";
                      }
                      if (value === "name") {
                        return "ファイル名";
                      }
                      return "サイズ";
                    };
                    return (
                      <SelectItem item={props.item}>
                        {getSortLabel(props.item.rawValue)}
                      </SelectItem>
                    );
                  }}
                  onChange={(value) =>
                    setLocalSearchState("sortBy", value || "date")
                  }
                  options={["date", "name", "size"]}
                  placeholder="項目"
                  value={localSearchState.sortBy}
                >
                  <SelectTrigger>
                    <SelectValue<string>>
                      {(state) => {
                        const value = state.selectedOption();
                        if (value === "date") {
                          return "作成日";
                        }
                        if (value === "name") {
                          return "ファイル名";
                        }
                        return "サイズ";
                      }}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
                <Select
                  itemComponent={(props) => (
                    <SelectItem item={props.item}>
                      {props.item.rawValue === "asc" ? "昇順" : "降順"}
                    </SelectItem>
                  )}
                  onChange={(value) =>
                    setLocalSearchState("sortOrder", value || "desc")
                  }
                  options={["asc", "desc"]}
                  placeholder="順序"
                  value={localSearchState.sortOrder}
                >
                  <SelectTrigger>
                    <SelectValue<string>>
                      {(state) =>
                        state.selectedOption() === "asc" ? "昇順" : "降順"
                      }
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent />
                </Select>
              </div>
            </div>
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
