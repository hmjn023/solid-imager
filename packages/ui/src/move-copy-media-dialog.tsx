import { t } from "@solid-imager/i18n";
import { createEffect, createMemo, createSignal, Show } from "solid-js";
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

	createEffect(() => {
		if (!props.open) setTargetSourceId(null);
	});

	const handleConfirm = () => {
		const target = targetSourceId();
		if (target) {
			props.onConfirm(target);
			props.onOpenChange(false);
			setTargetSourceId(null);
		}
	};

	const options = createMemo(() =>
		props.sources.flatMap((s) =>
			s.id !== props.currentSourceId ? [{ value: s.id, label: s.name }] : [],
		),
	);

	return (
		<Dialog onOpenChange={props.onOpenChange} open={props.open}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>
						{props.mode === "copy"
							? t("moveCopyMediaDialog.copyMedia")
							: t("moveCopyMediaDialog.moveMedia")}
					</DialogTitle>
					<DialogDescription>
						{t(
							"moveCopyMediaDialog.selectTheDestinationSourceForThisMediaItemValue",
							{
								value0: String(
									props.mode === "move" &&
										t(
											"moveCopyMediaDialog.theOriginalItemWillBeDeletedAfterASuccessful",
										),
								),
							},
						)}
					</DialogDescription>
				</DialogHeader>

				<div class="py-4">
					<Show when={props.isLoading}>
						<p class="text-muted-foreground text-sm">
							{t("moveCopyMediaDialog.loadingSources")}
						</p>
					</Show>
					<Show when={props.error}>
						<p class="text-destructive text-sm">{props.error}</p>
					</Show>
					<Show when={!(props.isLoading || props.error)}>
						<Select<{ value: string; label: string }>
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{itemProps.item.rawValue.label}
								</SelectItem>
							)}
							onChange={(val) => setTargetSourceId(val?.value ?? null)}
							options={options()}
							optionTextValue="label"
							optionValue="value"
							placeholder={t("actions.selectSource")}
							value={
								options().find((o) => o.value === targetSourceId()) ?? null
							}
						>
							<SelectTrigger
								aria-label={t("moveCopyMediaDialog.destinationSource")}
							>
								<SelectValue<{ label: string; value: string }>>
									{(state) =>
										state.selectedOption()?.label ?? t("actions.selectSource")
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</Show>
				</div>

				<DialogFooter>
					<Button onClick={() => props.onOpenChange(false)} variant="outline">
						{t("actions.cancel")}
					</Button>
					<Button disabled={!targetSourceId()} onClick={handleConfirm}>
						{props.mode === "copy"
							? t("moveCopyMediaDialog.copy")
							: t("moveCopyMediaDialog.move")}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
