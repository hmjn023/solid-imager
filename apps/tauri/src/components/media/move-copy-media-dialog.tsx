import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import { createResource, createSignal, Show } from "solid-js";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

type MoveCopyMediaDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "copy" | "move";
	onConfirm: (targetSourceId: string) => void;
	currentSourceId: string;
};

export function MoveCopyMediaDialog(props: MoveCopyMediaDialogProps) {
	const [targetSourceId, setTargetSourceId] = createSignal<string | null>(null);
	const [sources] = createResource(
		() => props.open,
		async (isOpen) => {
			if (!isOpen) {
				return [];
			}
			return fetchMediaSources();
		},
	);

	const options = () =>
		(sources() || [])
			.filter((source) => source.id !== props.currentSourceId)
			.map((source) => ({ value: source.id, label: source.name }));

	const handleConfirm = () => {
		const target = targetSourceId();
		if (!target) {
			return;
		}
		props.onConfirm(target);
		props.onOpenChange(false);
		setTargetSourceId(null);
	};

	return (
		<Dialog onOpenChange={props.onOpenChange} open={props.open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{props.mode === "copy" ? "Copy Media" : "Move Media"}</DialogTitle>
					<DialogDescription>Select the destination source for this media item.</DialogDescription>
				</DialogHeader>
				<div class="py-4">
					<Show when={sources.loading}>
						<p class="text-muted-foreground text-sm">Loading sources...</p>
					</Show>
					<Show when={!(sources.loading || sources.error)}>
						<Select
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{(itemProps.item.rawValue as { label: string }).label}
								</SelectItem>
							)}
							onChange={(value) => setTargetSourceId(value?.value ?? null)}
							options={options()}
							optionTextValue="label"
							optionValue="value"
							value={options().find((option) => option.value === targetSourceId())}
						>
							<SelectTrigger>
								<SelectValue<{ label: string; value: string }>>
									{(state) => state.selectedOption()?.label ?? "Select a source"}
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
