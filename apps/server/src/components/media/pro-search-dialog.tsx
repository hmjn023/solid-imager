import { t } from "@solid-imager/i18n";
import type { Author } from "@solid-imager/core/authors";
import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import type { SearchGroup } from "@solid-imager/core/search";
import type { Project } from "@solid-imager/core/projects";
import type { TagResponse } from "@solid-imager/core/tags";
import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import { createSignal } from "solid-js";

import { ProSearchBuilder } from "./pro-search-builder";

type Props = {
	tags?: TagResponse[];
	projects?: Project[];
	ips?: Ip[];
	characters?: Character[];
	authors?: Author[];
	value: SearchGroup | null;
	onChange: (value: SearchGroup | null) => void;
	onSearch: () => void;
};

export function ProSearchDialog(props: Props) {
	const [open, setOpen] = createSignal(false);

	return (
		<Dialog onOpenChange={setOpen} open={open()}>
			<DialogTrigger as={Button} class="w-full" variant="outline">
				{t("proSearchDialog.editAdvancedConditions")}
			</DialogTrigger>
			<DialogContent class="flex max-w-5xl flex-col">
				<DialogHeader>
					<DialogTitle>
						{t("proSearchDialog.editAdvancedSearchConditions")}
					</DialogTitle>
				</DialogHeader>
				<div class="flex-1 overflow-y-auto p-1">
					<ProSearchBuilder
						authors={props.authors}
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
						{t("actions.search")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
