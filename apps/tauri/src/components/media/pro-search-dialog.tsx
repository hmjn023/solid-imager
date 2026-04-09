import type { SearchGroup } from "@solid-imager/core/domain/media/schemas";
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
import type { TauriSearchFilterData } from "./search-filters";

type Props = {
	filterData: TauriSearchFilterData;
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
						filterData={props.filterData}
						onChange={props.onChange}
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
