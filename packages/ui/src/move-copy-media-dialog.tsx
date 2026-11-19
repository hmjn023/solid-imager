import type { SafeMediaSource } from "@solid-imager/core/sources";
import { t } from "@solid-imager/i18n";
import { createEffect, createSignal, Show } from "solid-js";
import { Alert, AlertDescription } from "./alert";
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
	MediaDestinationField,
	useMediaDestinationSources,
} from "./media-destination-field";

export type MoveCopyMediaDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: "copy" | "move";
	currentSourceId: string;
	listSources: () => Promise<SafeMediaSource[]>;
	isSubmitting: boolean;
	error?: string;
	onConfirm: (targetSourceId: string) => Promise<void>;
};

export function MoveCopyMediaDialog(props: MoveCopyMediaDialogProps) {
	const [targetSourceId, setTargetSourceId] = createSignal("");
	const sourceList = useMediaDestinationSources(
		() => props.open,
		props.listSources,
	);
	const options = () =>
		sourceList
			.sources()
			.filter((source) => source.id !== props.currentSourceId);
	const target = () =>
		options().find((source) => source.id === targetSourceId());
	const canSubmit = () =>
		!props.isSubmitting && !sourceList.loading() && Boolean(target());

	createEffect(() => {
		if (!props.open) setTargetSourceId("");
	});

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!props.isSubmitting) props.onOpenChange(open);
			}}
			open={props.open}
		>
			<DialogContent
				class="workspace-theme sm:max-w-dialog-xs"
				closeDisabled={props.isSubmitting}
			>
				<DialogHeader>
					<DialogTitle>
						{props.mode === "copy"
							? t("moveCopyMediaDialog.copyMedia")
							: t("moveCopyMediaDialog.moveMedia")}
					</DialogTitle>
					<DialogDescription>
						{t(
							props.mode === "copy"
								? "moveCopyMediaDialog.copyDescription"
								: "moveCopyMediaDialog.moveDescription",
						)}
					</DialogDescription>
				</DialogHeader>

				<form
					class="grid gap-4"
					onSubmit={(event) => {
						event.preventDefault();
						const destination = target();
						if (canSubmit() && destination)
							void props.onConfirm(destination.id);
					}}
				>
					<MediaDestinationField
						options={options()}
						value={target()}
						onChange={setTargetSourceId}
						disabled={props.isSubmitting}
						loading={sourceList.loading()}
						failed={sourceList.failed()}
						onRetry={sourceList.retry}
					/>
					<Show when={props.error}>
						<Alert variant="destructive">
							<AlertDescription>{props.error}</AlertDescription>
						</Alert>
					</Show>
					<DialogFooter>
						<Button
							disabled={props.isSubmitting}
							onClick={() => props.onOpenChange(false)}
							type="button"
							variant="outline"
						>
							{t("actions.cancel")}
						</Button>
						<Button
							aria-busy={props.isSubmitting}
							disabled={!canSubmit()}
							type="submit"
						>
							{props.isSubmitting
								? t("status.processing")
								: props.mode === "copy"
									? t("moveCopyMediaDialog.copy")
									: t("moveCopyMediaDialog.move")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
