import { createSignal, Show } from "solid-js";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "./dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";

export type MoveCopyMediaDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "copy" | "move";
	currentSourceId: string;
	sources: { id: string; name: string }[];
	isLoading?: boolean;
	error?: string | null;
	onConfirm: (targetSourceId: string) => void;
};

export function MoveCopyMediaDialog(props: MoveCopyMediaDialogProps) {
	const [targetSourceId, setTargetSourceId] = createSignal<string | null>(null);

	const handleConfirm = () => {
		const target = targetSourceId();
		if (target) {
			props.onConfirm(target);
			props.onOpenChange(false);
			setTargetSourceId(null);
		}
	};

	const options = () =>
		props.sources
			.filter((s) => s.id !== props.currentSourceId)
			.map((s) => ({ value: s.id, label: s.name }));

	return (
		<Dialog onOpenChange={props.onOpenChange} open={props.open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{props.mode === "copy" ? "Copy Media" : "Move Media"}
					</DialogTitle>
					<DialogDescription>
						Select the destination source for this media item.
						{props.mode === "move" &&
							" The original item will be deleted after a successful copy."}
					</DialogDescription>
				</DialogHeader>

				<div class="py-4">
					<Show when={props.isLoading}>
						<p class="text-muted-foreground text-sm">Loading sources...</p>
					</Show>
					<Show when={props.error}>
						<p class="text-red-500 text-sm">{props.error}</p>
					</Show>
					<Show when={!(props.isLoading || props.error)}>
						<Select
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{(itemProps.item.rawValue as { label: string }).label}
								</SelectItem>
							)}
							onChange={(val) => setTargetSourceId(val?.value ?? null)}
							options={options()}
							optionTextValue="label"
							optionValue="value"
							value={
								options().find((o) => o.value === targetSourceId()) ?? null
							}
						>
							<SelectTrigger>
								<SelectValue<{ label: string; value: string }>>
									{(state) =>
										state.selectedOption()?.label ?? "Select a source"
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</Show>
				</div>

				<DialogFooter>
					<Button onClick={() => props.onOpenChange(false)} variant="outline">
						Cancel
					</Button>
					<Button disabled={!targetSourceId()} onClick={handleConfirm}>
						{props.mode === "copy" ? "Copy" : "Move"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
