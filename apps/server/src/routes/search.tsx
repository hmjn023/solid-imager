import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { A } from "@solidjs/router";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js";
import { isServer, Portal } from "solid-js/web";
import { SearchFilters } from "~/components/media/search-filters";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { useMediaSourceEvents } from "~/hooks/use-media-source-events";
import { fetchAllAuthors } from "~/infrastructure/api-clients/authors-api";
import { fetchAllCharacters } from "~/infrastructure/api-clients/characters-api";
import { fetchAllIps } from "~/infrastructure/api-clients/ips-api";
import { fetchAllProjects } from "~/infrastructure/api-clients/projects-api";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";
import { fetchTags } from "~/infrastructure/api-clients/tags-api";
import { searchState, setSearchState } from "~/presentation/store/search-store";

// Type alias to avoid conflict with DOM MediaSource API
type Source = SafeMediaSource;

const buildSearchParams = (state: typeof searchState) => ({
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
  limit: state.limit,
  offset: state.offset,
});

type SourceSelectorProps = {
  sources: Source[] | undefined;
  selectedSource: string;
  onSelect: (id: string) => void;
};

const SourceSelector = (props: SourceSelectorProps) => (
  <div class="space-y-2">
    <Label>メディアソース</Label>
    <Select
      itemComponent={(itemProps) => (
        <SelectItem item={itemProps.item}>
          {itemProps.item.rawValue.name}
        </SelectItem>
      )}
      onChange={(value) => {
        const id =
          typeof value === "object" && value !== null && "id" in value
            ? (value as Source).id
            : "";
        props.onSelect(id || "");
      }}
      options={props.sources || []}
      optionTextValue="name"
      optionValue="name"
      placeholder="ソースを選択"
      value={props.sources?.find((s) => s.id === props.selectedSource)}
    >
      <SelectTrigger>
        <SelectValue<Source>>
          {(state) => {
            const source = state.selectedOption() as Source | undefined;
            return source?.name || "ソースを選択";
          }}
        </SelectValue>
      </SelectTrigger>
      <SelectContent />
    </Select>
  </div>
);

export default function Search() {
  const queryClient = useQueryClient();
  const [isRestored, setIsRestored] = createSignal(false);

  createEffect(() => {
    if (isServer) {
      return;
    }
    if (!(searchResults.isLoading || isRestored())) {
      if (searchState.scrollY > 0) {
        window.scrollTo(0, searchState.scrollY);
      }
      setIsRestored(true);
    }
  });

  onCleanup(() => {
    if (isServer) {
      return;
    }
    setSearchState("scrollY", window.scrollY);
  });

  // Fetch filter data
  const tags = createQuery<TagResponse[]>(() => ({
    queryKey: ["tags"],
    queryFn: fetchTags,
  }));
  const sources = createQuery<Source[]>(() => ({
    queryKey: ["mediaSources"],
    queryFn: fetchMediaSources,
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

  // Search function
  const searchResults = createQuery(() => ({
    queryKey: ["searchResults", { ...searchState }],
    queryFn: async () => {
      const source = searchState.selectedSource;
      if (!source) {
        return { media: [], total: 0 };
      }

      return await searchMedia(source, buildSearchParams(searchState));
    },
    enabled: !!searchState.selectedSource,
  }));

  // Subscribe to real-time events for the selected source
  useMediaSourceEvents(() => searchState.selectedSource || undefined, {
    onMediaAdded: () => {
      // Invalidate all search results to ensure any matching new media appears
      queryClient.invalidateQueries({ queryKey: ["searchResults"] });
    },
    onMediaDeleted: () => {
      queryClient.invalidateQueries({ queryKey: ["searchResults"] });
    },
    onMediaChanged: () => {
      queryClient.invalidateQueries({ queryKey: ["searchResults"] });
    },
  });

  const handleSearch = () => {
    setSearchState("offset", 0);
    setSearchState("scrollY", 0);
    window.scrollTo(0, 0);
    // refetch is automatic due to resource dependency
  };

  const handleNextPage = () => {
    setSearchState("offset", (prev) => prev + searchState.limit);
    setSearchState("scrollY", 0);
    window.scrollTo(0, 0);
  };

  const handlePrevPage = () => {
    setSearchState("offset", (prev) => Math.max(0, prev - searchState.limit));
    setSearchState("scrollY", 0);
    window.scrollTo(0, 0);
  };

  return (
    <main class="container mx-auto p-4">
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
              <div class="space-y-4">
                <SourceSelector
                  onSelect={(id) => setSearchState("selectedSource", id)}
                  selectedSource={searchState.selectedSource}
                  sources={sources.data}
                />
                <SearchFilters
                  authors={allAuthors.data}
                  characters={allCharacters.data}
                  ips={allIps.data}
                  onSearch={handleSearch}
                  projects={allProjects.data}
                  setState={setSearchState}
                  state={searchState}
                  tags={tags.data}
                />
              </div>
            </DialogContent>
          </Dialog>
        </Portal>
      </Show>

      <div class="mb-8 flex items-center justify-between">
        <div>
          <h1 class="mb-2 font-bold text-3xl">メディア検索</h1>
          <p class="text-gray-600">タグやファイル名でメディアを検索できます</p>
        </div>
      </div>

      <div class="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Search Filters (Desktop only) */}
        <Card class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block">
          <CardHeader>
            <CardTitle>検索フィルター</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            <SourceSelector
              onSelect={(id) => setSearchState("selectedSource", id)}
              selectedSource={searchState.selectedSource}
              sources={sources.data}
            />
            <SearchFilters
              authors={allAuthors.data}
              characters={allCharacters.data}
              ips={allIps.data}
              onSearch={handleSearch}
              projects={allProjects.data}
              setState={setSearchState}
              state={searchState}
              tags={tags.data}
              usePopover={false}
            />
          </CardContent>
        </Card>

        {/* Search Results */}
        <div class="space-y-4">
          <Show
            fallback={<div class="py-8 text-center">読み込み中...</div>}
            when={!searchResults.isLoading}
          >
            <Show
              fallback={
                <div class="py-8 text-center text-gray-500">
                  メディアソースを選択して検索してください
                </div>
              }
              when={searchResults.data}
            >
              <div class="mb-4 flex items-center justify-between">
                <p class="text-gray-600 text-sm">
                  {searchResults.data?.total || 0} 件の結果
                </p>
                <div class="flex gap-2">
                  <Button
                    disabled={searchState.offset === 0}
                    onClick={handlePrevPage}
                    size="sm"
                    variant="outline"
                  >
                    前へ
                  </Button>
                  <Button
                    disabled={
                      searchState.offset + searchState.limit >=
                      (searchResults.data?.total || 0)
                    }
                    onClick={handleNextPage}
                    size="sm"
                    variant="outline"
                  >
                    次へ
                  </Button>
                </div>
              </div>

              <div class="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                <For each={searchResults.data?.media || []}>
                  {(media) => (
                    <Card class="overflow-hidden transition-shadow hover:shadow-lg">
                      <CardContent class="p-4">
                        <div class="mb-2 flex aspect-video items-center justify-center rounded bg-gray-100">
                          <Show
                            fallback={
                              <div class="text-gray-400">{media.mediaType}</div>
                            }
                            when={media.mediaType === "image"}
                          >
                            {/* biome-ignore lint/performance/noImgElement: Using standard img for simplicity */}
                            {/* biome-ignore lint/nursery/useImageSize: Aspect ratio container handles sizing */}
                            <img
                              alt={media.fileName}
                              class="h-full w-full object-cover"
                              src={`/api/sources/${searchState.selectedSource}/${media.id}/thumbnail`}
                            />
                          </Show>
                        </div>
                        <h3
                          class="truncate font-semibold"
                          title={media.fileName}
                        >
                          {media.fileName}
                        </h3>
                        <p class="truncate text-gray-500 text-sm">
                          {media.filePath}
                        </p>
                        <div class="mt-2 flex justify-between text-gray-400 text-xs">
                          <span>
                            {media.width && media.height
                              ? `${media.width}×${media.height}`
                              : "N/A"}
                          </span>
                          <span>
                            {media.fileSize
                              ? (() => {
                                  const BytesToKb = 1024;
                                  return `${(media.fileSize / BytesToKb).toFixed(1)}KB`;
                                })()
                              : "N/A"}
                          </span>
                        </div>
                        <A
                          class="mt-2 block text-center text-blue-600 text-sm hover:underline"
                          href={`/sources/${searchState.selectedSource}/${media.id}`}
                        >
                          詳細を見る
                        </A>
                      </CardContent>
                    </Card>
                  )}
                </For>
              </div>

              <Show when={(searchResults.data?.media || []).length === 0}>
                <div class="py-12 text-center text-gray-500">
                  検索結果が見つかりませんでした
                </div>
              </Show>
            </Show>
          </Show>
        </div>
      </div>
    </main>
  );
}
