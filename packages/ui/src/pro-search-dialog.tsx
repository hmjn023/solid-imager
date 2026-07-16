import type { Author } from "@solid-imager/core/domain/authors/schemas";
import type { Character } from "@solid-imager/core/domain/characters/schemas";
import type { Ip } from "@solid-imager/core/domain/ips/schemas";
import type { SearchGroup } from "@solid-imager/core/domain/media/schemas";
import type { Project } from "@solid-imager/core/domain/projects/schemas";
import type { TagResponse } from "@solid-imager/core/domain/tags/schemas";
import { createSignal } from "solid-js";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";
import { ProSearchBuilder } from "./pro-search-builder";

type Props = {
	tags?: TagResponse[];
	projects?: Project[];
	ips?: Ip[];
	characters?: Character[];
	authors?: Author[];
	value: SearchGroup | null;
	onChange: (value: SearchGroup | null) => void;
	onSearch?: () => void;
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
							props.onSearch?.();
							setOpen(false);
						}}
					>
						{props.onSearch ? "検索" : "完了"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
