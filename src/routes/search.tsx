import { A } from "@solidjs/router";
import { createResource, createSignal, For, Show } from "solid-js";
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
  const [selectedTags, setSelectedTags] = createSignal<string[]>([]);
  const [excludeTags, setExcludeTags] = createSignal<string[]>([]);
  const [tagMode, setTagMode] = createSignal<"and" | "or">("and");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [sortBy, setSortBy] = createSignal<"date" | "name" | "size">("date");
  const [sortOrder, setSortOrder] = createSignal<"asc" | "desc">("desc");
  const [selectedSource, setSelectedSource] = createSignal<string>("");
  const [selectedProjects, setSelectedProjects] = createSignal<number[]>([]);
  const [selectedIps, setSelectedIps] = createSignal<number[]>([]);
  const [selectedCharacters, setSelectedCharacters] = createSignal<number[]>(
    []
  );
  const DefaultLimit = 20;
  const [limit, _setLimit] = createSignal(DefaultLimit);
  const [offset, setOffset] = createSignal(0);
  const [_commandOpen, setCommandOpen] = createSignal(false);
  const [_excludeCommandOpen, setExcludeCommandOpen] = createSignal(false);

  // Fetch all tags for autocomplete
  const [tags] = createResource<TagResponse[]>(fetchTags);

  // Fetch media sources
  const [sources] = createResource<Source[]>(fetchMediaSources);

  // Fetch all projects, IPs, and characters
  const [allProjects] = createResource(fetchAllProjects);
  const [allIps] = createResource(fetchAllIps);
  const [allCharacters] = createResource(fetchAllCharacters);

  // Search function
  const [searchResults, { refetch }] = createResource(async () => {
    const source = selectedSource();
    if (!source) {
      return { media: [], total: 0 };
    }

    return await searchMedia(source, {
      q: searchQuery(),
      tags: selectedTags().length > 0 ? selectedTags().join(",") : undefined,
      excludeTags:
        excludeTags().length > 0 ? excludeTags().join(",") : undefined,
      tagMode: tagMode(),
      projects:
        selectedProjects().length > 0
          ? selectedProjects().join(",")
          : undefined,
      ips: selectedIps().length > 0 ? selectedIps().join(",") : undefined,
      characters:
        selectedCharacters().length > 0
          ? selectedCharacters().join(",")
          : undefined,
      sort: sortBy(),
      order: sortOrder(),
      limit: limit(),
      offset: offset(),
    });
  });

  const handleSearch = () => {
    setOffset(0);
    refetch();
  };

  const handleNextPage = () => {
    setOffset((prev) => prev + limit());
    refetch();
  };

  const handlePrevPage = () => {
    setOffset((prev) => Math.max(0, prev - limit()));
    refetch();
  };

  const addTag = (tagName: string) => {
    if (!selectedTags().includes(tagName)) {
      setSelectedTags([...selectedTags(), tagName]);
    }
    setCommandOpen(false);
  };

  const removeTag = (tagName: string) => {
    setSelectedTags(selectedTags().filter((t) => t !== tagName));
  };

  const addExcludeTag = (tagName: string) => {
    if (!excludeTags().includes(tagName)) {
      setExcludeTags([...excludeTags(), tagName]);
    }
    setExcludeCommandOpen(false);
  };

  const removeExcludeTag = (tagName: string) => {
    setExcludeTags(excludeTags().filter((t) => t !== tagName));
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
                  setSelectedSource(id || "");
                }}
                options={sources() || []}
                optionTextValue="name"
                optionValue="name"
                placeholder="ソースを選択"
                value={sources()?.find((s) => s.id === selectedSource())}
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
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
                placeholder="ファイル名を入力..."
                type="text"
                value={searchQuery()}
              />
            </div>

            {/* Tag Selection with Command */}
            <div class="space-y-2">
              <Label>タグ (含む)</Label>
              <div class="mb-2 flex flex-wrap gap-2">
                <For each={selectedTags()}>
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
                    <For each={tags()}>
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
                onChange={setTagMode}
                options={["and", "or"]}
                placeholder="モードを選択"
                value={tagMode()}
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
                <For each={excludeTags()}>
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
                    <For each={tags()}>
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
                <For each={selectedProjects()}>
                  {(projectId) => {
                    const project = allProjects()?.find(
                      (p) => p.id === projectId
                    );
                    return (
                      <Badge class="cursor-pointer" variant="secondary">
                        {project?.name || projectId}
                        <button
                          class="ml-1 hover:text-red-500"
                          onClick={() =>
                            setSelectedProjects(
                              selectedProjects().filter(
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
                    <For each={allProjects()}>
                      {(project) => (
                        <CommandItem
                          class="cursor-pointer"
                          onSelect={() => {
                            if (!selectedProjects().includes(project.id)) {
                              setSelectedProjects([
                                ...selectedProjects(),
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
                <For each={selectedIps()}>
                  {(ipId) => {
                    const ip = allIps()?.find((i) => i.id === ipId);
                    return (
                      <Badge class="cursor-pointer" variant="secondary">
                        {ip?.name || ipId}
                        <button
                          class="ml-1 hover:text-red-500"
                          onClick={() =>
                            setSelectedIps(
                              selectedIps().filter((id) => id !== ipId)
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
                    <For each={allIps()}>
                      {(ip) => (
                        <CommandItem
                          class="cursor-pointer"
                          onSelect={() => {
                            if (!selectedIps().includes(ip.id)) {
                              setSelectedIps([...selectedIps(), ip.id]);
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
                <For each={selectedCharacters()}>
                  {(characterId) => {
                    const character = allCharacters()?.find(
                      (c) => c.id === characterId
                    );
                    return (
                      <Badge class="cursor-pointer" variant="secondary">
                        {character?.name || characterId}
                        <button
                          class="ml-1 hover:text-red-500"
                          onClick={() =>
                            setSelectedCharacters(
                              selectedCharacters().filter(
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
                    <For each={allCharacters()}>
                      {(character) => (
                        <CommandItem
                          class="cursor-pointer"
                          onSelect={() => {
                            if (!selectedCharacters().includes(character.id)) {
                              setSelectedCharacters([
                                ...selectedCharacters(),
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
                  onChange={setSortBy}
                  options={["date", "name", "size"]}
                  placeholder="項目"
                  value={sortBy()}
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
                  onChange={setSortOrder}
                  options={["asc", "desc"]}
                  placeholder="順序"
                  value={sortOrder()}
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
            when={!searchResults.loading}
          >
            <Show
              fallback={
                <div class="py-8 text-center text-gray-500">
                  メディアソースを選択して検索してください
                </div>
              }
              when={searchResults()}
            >
              <div class="mb-4 flex items-center justify-between">
                <p class="text-gray-600 text-sm">
                  {searchResults()?.total || 0} 件の結果
                </p>
                <div class="flex gap-2">
                  <Button
                    disabled={offset() === 0}
                    onClick={handlePrevPage}
                    size="sm"
                    variant="outline"
                  >
                    前へ
                  </Button>
                  <Button
                    disabled={
                      offset() + limit() >= (searchResults()?.total || 0)
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
                <For each={searchResults()?.media || []}>
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
                              src={`/api/sources/${selectedSource()}/${media.id}/thumbnail`}
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
                          href={`/sources/${selectedSource()}/${media.id}`}
                        >
                          詳細を見る
                        </A>
                      </CardContent>
                    </Card>
                  )}
                </For>
              </div>

              <Show when={(searchResults()?.media || []).length === 0}>
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
