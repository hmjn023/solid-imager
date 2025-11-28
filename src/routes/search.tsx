import { A } from "@solidjs/router";
import { createQuery } from "@tanstack/solid-query";
import {
  createEffect,
  createSignal,
  For,
  onCleanup,
  Show,
} from "solid-js";
import { isServer } from "solid-js/web";
import { Badge } from "~/components/ui/badge";
import { Button } from "~/components/ui/button";
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
import { searchState, setSearchState } from "~/domain/search/store";
import type { MediaSourceInfo } from "~/domain/sources/schemas";
import type { TagResponse } from "~/domain/tags/schemas";
import { fetchAllCharacters } from "~/infrastructure/api-clients/characters-api";
import { fetchAllIps } from "~/infrastructure/api-clients/ips-api";
import { fetchAllProjects } from "~/infrastructure/api-clients/projects-api";
import { searchMedia } from "~/infrastructure/api-clients/search-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";
import { fetchTags } from "~/infrastructure/api-clients/tags-api";

// Type alias to avoid conflict with DOM MediaSource API
type Source = MediaSourceInfo;

export default function Search() {
  const [_commandOpen, setCommandOpen] = createSignal(false);
  const [_excludeCommandOpen, setExcludeCommandOpen] = createSignal(false);
  const [isRestored, setIsRestored] = createSignal(false);

  createEffect(() => {
    if (isServer) return;
    if (!(searchResults.isLoading || isRestored())) {
      if (searchState.scrollY > 0) {
        window.scrollTo(0, searchState.scrollY);
      }
      setIsRestored(true);
    }
  });

  onCleanup(() => {
    if (isServer) return;
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

  // Search function
  const searchResults = createQuery(() => ({
    queryKey: ["searchResults", { ...searchState }],
    queryFn: async () => {
      const state = searchState;
      const source = state.selectedSource;
      if (!source) {
        return { media: [], total: 0 };
      }

      return await searchMedia(source, {
        q: state.searchQuery,
        tags:
          state.selectedTags.length > 0
            ? state.selectedTags.join(",")
            : undefined,
        excludeTags:
          state.excludeTags.length > 0
            ? state.excludeTags.join(",")
            : undefined,
        tagMode: state.tagMode,
        projects:
          state.selectedProjects.length > 0
            ? state.selectedProjects.join(",")
            : undefined,
        ips:
          state.selectedIps.length > 0
            ? state.selectedIps.join(",")
            : undefined,
        characters:
          state.selectedCharacters.length > 0
            ? state.selectedCharacters.join(",")
            : undefined,
        sort: state.sortBy,
        order: state.sortOrder,
        limit: state.limit,
        offset: state.offset,
      });
    },
    enabled: !!searchState.selectedSource,
  }));

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

  const addTag = (tagName: string) => {
    if (!searchState.selectedTags.includes(tagName)) {
      setSearchState("selectedTags", [...searchState.selectedTags, tagName]);
    }
    setCommandOpen(false);
  };

  const removeTag = (tagName: string) => {
    setSearchState(
      "selectedTags",
      searchState.selectedTags.filter((t) => t !== tagName)
    );
  };

  const addExcludeTag = (tagName: string) => {
    if (!searchState.excludeTags.includes(tagName)) {
      setSearchState("excludeTags", [...searchState.excludeTags, tagName]);
    }
    setExcludeCommandOpen(false);
  };

  const removeExcludeTag = (tagName: string) => {
    setSearchState(
      "excludeTags",
      searchState.excludeTags.filter((t) => t !== tagName)
    );
  };

  return (
    <main class="container mx-auto p-4">
      <div class="mb-8">
        <h1 class="mb-2 font-bold text-3xl">メディア検索</h1>
        <p class="text-gray-600">タグやファイル名でメディアを検索できます</p>
      </div>

      <div class="grid gap-6 md:grid-cols-[300px_1fr]">
        {/* Search Filters */}
        <Card>
          <CardHeader>
            <CardTitle>検索フィルター</CardTitle>
          </CardHeader>
          <CardContent class="space-y-4">
            {/* Media Source Selector */}
            <div class="space-y-2">
              <Label>メディアソース</Label>
              <Select
                itemComponent={(props) => (
                  <SelectItem item={props.item}>
                    {props.item.rawValue.name}
                  </SelectItem>
                )}
                onChange={(value) => {
                  // The Select component passes the entire object, not just the id
                  const id =
                    typeof value === "object" && value !== null && "id" in value
                      ? (value as Source).id
                      : "";
                  setSearchState("selectedSource", id || "");
                }}
                options={sources.data || []}
                optionTextValue="name"
                optionValue="name"
                placeholder="ソースを選択"
                value={sources.data?.find(
                  (s) => s.id === searchState.selectedSource
                )}
              >
                <SelectTrigger>
                  <SelectValue<Source>>
                    {(state) => {
                      const source = state.selectedOption() as
                        | Source
                        | undefined;
                      return source?.name || "ソースを選択";
                    }}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>

            {/* Filename Search */}
            <div class="space-y-2">
              <Label>ファイル名検索</Label>
              <Input
                onInput={(e) =>
                  setSearchState("searchQuery", e.currentTarget.value)
                }
                placeholder="ファイル名を入力..."
                type="text"
                value={searchState.searchQuery}
              />
            </div>

            {/* Tag Selection with Command */}
            <div class="space-y-2">
              <Label>タグ (含む)</Label>
              <div class="mb-2 flex flex-wrap gap-2">
                <For each={searchState.selectedTags}>
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
                onChange={(value) => setSearchState("tagMode", value || "and")}
                options={["and", "or"]}
                placeholder="モードを選択"
                value={searchState.tagMode}
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
                <For each={searchState.excludeTags}>
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
                <For each={searchState.selectedProjects}>
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
                            setSearchState(
                              "selectedProjects",
                              searchState.selectedProjects.filter(
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
                              !searchState.selectedProjects.includes(project.id)
                            ) {
                              setSearchState("selectedProjects", [
                                ...searchState.selectedProjects,
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
                <For each={searchState.selectedIps}>
                  {(ipId) => {
                    const ip = allIps.data?.find((i) => i.id === ipId);
                    return (
                      <Badge class="cursor-pointer" variant="secondary">
                        {ip?.name || ipId}
                        <button
                          class="ml-1 hover:text-red-500"
                          onClick={() =>
                            setSearchState(
                              "selectedIps",
                              searchState.selectedIps.filter(
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
                            if (!searchState.selectedIps.includes(ip.id)) {
                              setSearchState("selectedIps", [
                                ...searchState.selectedIps,
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
                <For each={searchState.selectedCharacters}>
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
                            setSearchState(
                              "selectedCharacters",
                              searchState.selectedCharacters.filter(
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
                              !searchState.selectedCharacters.includes(
                                character.id
                              )
                            ) {
                              setSearchState("selectedCharacters", [
                                ...searchState.selectedCharacters,
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
                    setSearchState("sortBy", value || "date")
                  }
                  options={["date", "name", "size"]}
                  placeholder="項目"
                  value={searchState.sortBy}
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
                    setSearchState("sortOrder", value || "desc")
                  }
                  options={["asc", "desc"]}
                  placeholder="順序"
                  value={searchState.sortOrder}
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

            <Button class="w-full" onClick={handleSearch}>
              検索
            </Button>
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
