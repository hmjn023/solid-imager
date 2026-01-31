import { createSignal } from "solid-js";
import { Button } from "~/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "~/components/ui/dialog";
import type { Character } from "~/domain/characters/schemas";
import type { Ip } from "~/domain/ips/schemas";
import type { SearchGroup } from "~/domain/media/schemas";
import type { Project } from "~/domain/projects/schemas";
import type { TagResponse } from "~/domain/tags/schemas";

import { ProSearchBuilder } from "./pro-search-builder";

type Props = {
  tags?: TagResponse[];
  projects?: Project[];
  ips?: Ip[];
  characters?: Character[];
  value: SearchGroup | null;
  onChange: (value: SearchGroup | null) => void;
  onSearch: () => void;
};

export function ProSearchDialog(props: Props) {
  const [open, setOpen] = createSignal(false);

  return (
    <Dialog onOpenChange={setOpen} open={open()}>
      <DialogTrigger as={Button} class="w-full" variant="outline">
        詳細条件を編集
      </DialogTrigger>
      <DialogContent class="flex max-h-[90vh] max-w-5xl flex-col">
        <DialogHeader>
          <DialogTitle>詳細検索条件の編集</DialogTitle>
        </DialogHeader>
        <div class="flex-1 overflow-y-auto p-1">
          <ProSearchBuilder
            characters={props.characters}
            ips={props.ips}
            onChange={props.onChange}
            projects={props.projects}
            tags={props.tags}
            value={props.value}
          />
        </div>
        <DialogFooter>
          <Button
            onClick={() => {
              props.onSearch();
              setOpen(false);
            }}
          >
            検索
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
