import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import { Label } from "@solid-imager/ui/label";
import { Textarea } from "@solid-imager/ui/textarea";
import { createSignal } from "solid-js";

type Props = {
	value: string;
	onChange: (value: string) => void;
	onSearch: () => void;
};

export function ProSearchDialog(props: Props) {
	const [open, setOpen] = createSignal(false);

	return (
		<Dialog onOpenChange={setOpen} open={open()}>
			<DialogTrigger as={Button} class="w-full" variant="outline">
				詳細条件を編集
			</DialogTrigger>
			<DialogContent class="flex max-h-[90vh] max-w-3xl flex-col">
				<DialogHeader>
					<DialogTitle>詳細検索条件の編集</DialogTitle>
				</DialogHeader>
				<div class="flex-1 space-y-3 overflow-y-auto p-1">
					<p class="text-muted-foreground text-sm">
						mock では JSON 条件を直接編集します。例:{" "}
						<code>{'{ "authorId": "author-nova", "status": "review" }'}</code>
					</p>
					<div class="space-y-2">
						<Label>詳細条件</Label>
						<Textarea
							onInput={(event) => props.onChange(event.currentTarget.value)}
							rows={12}
							value={props.value}
						/>
					</div>
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
