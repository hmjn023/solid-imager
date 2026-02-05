import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { type JSX, Show } from "solid-js";
import { Button } from "~/components/ui/button";
import {
  searchState,
  setSearchMode,
  setSearchState,
} from "~/presentation/store/search-store";
import { PresetManager } from "./preset-manager";
import { ProSearchBuilder } from "./pro-search-builder";
import { ProSearchDialog } from "./pro-search-dialog";
import { SearchFilters } from "./search-filters";
import { SortControls } from "./sort-controls";

type Props = {
  tags?: TagResponse[];
  projects?: Project[];
  ips?: Ip[];
  characters?: Character[];
  authors?: Author[];
  onSearch: () => void;
  usePopover?: boolean;
  children?: JSX.Element;
};

export function UnifiedSearchControls(props: Props) {
  return (
    <div class="space-y-4">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 rounded-lg border bg-muted p-1">
          <Button
            class="h-7 flex-1 text-xs px-2"
            onClick={() => setSearchMode("simple")}
            size="sm"
            type="button"
            variant={searchState.mode === "simple" ? "default" : "ghost"}
          >
            簡易検索
          </Button>
          <Button
            class="h-7 flex-1 text-xs px-2"
            onClick={() => setSearchMode("pro")}
            size="sm"
            type="button"
            variant={searchState.mode === "pro" ? "default" : "ghost"}
          >
            詳細検索
          </Button>
        </div>
      </div>

      {props.children}

      <SortControls
        onSortByChange={(val) => setSearchState("sortBy", val)}
        onSortOrderChange={(val) => setSearchState("sortOrder", val)}
        sortBy={searchState.sortBy}
        sortOrder={searchState.sortOrder}
      />

      <div classList={{ hidden: searchState.mode !== "simple" }}>
        <SearchFilters
          authors={props.authors}
          characters={props.characters}
          ips={props.ips}
          onSearch={props.onSearch}
          projects={props.projects}
          setState={setSearchState}
          state={searchState}
          tags={props.tags}
          usePopover={props.usePopover}
        />
      </div>

      <div
        class="space-y-4"
        classList={{ hidden: searchState.mode !== "pro" }}
      >
        <Show
          fallback={
            <>
              <ProSearchBuilder
                authors={props.authors}
                characters={props.characters}
                ips={props.ips}
                onChange={(val) => setSearchState("advancedCondition", val)}
                projects={props.projects}
                tags={props.tags}
                value={searchState.advancedCondition || null}
              />
              <Button class="w-full" onClick={props.onSearch} type="button">
                検索 (詳細)
              </Button>
            </>
          }
          when={props.usePopover === false}
        >
          <PresetManager class="w-full flex-col items-stretch" />
          <ProSearchDialog
            authors={props.authors}
            characters={props.characters}
            ips={props.ips}
            onChange={(val) => setSearchState("advancedCondition", val)}
            onSearch={props.onSearch}
            projects={props.projects}
            tags={props.tags}
            value={searchState.advancedCondition || null}
          />
          <Button class="w-full" onClick={props.onSearch} type="button">
            検索 (詳細)
          </Button>
        </Show>
      </div>
    </div>
  );
}
