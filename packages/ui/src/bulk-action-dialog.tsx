import { t } from "@solid-imager/i18n";
import type { SafeMediaSource } from "@solid-imager/core/sources";
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
import { Input } from "./input";
import {
	MediaDestinationField,
	useMediaDestinationSources,
} from "./media-destination-field";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectLabel,
	SelectTrigger,
	SelectValue,
} from "./select";
import {
	createBulkActionCommand,
	executeBulkActionCommand,
	type BulkActionCommand,
	type BulkActionItem,
	type BulkCommandOperations,
} from "./bulk-action-command";

export type BulkActionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mediaSourceId?: string;
	mediaIds: string[];
	mediaItems?: Array<{ mediaId: string; mediaSourceId: string }>;
	listSources: () => Promise<SafeMediaSource[]>;
	onSuccess: (partial: boolean, succeededMediaIds: string[]) => void;
} & BulkCommandOperations;

type ActionType = "copy-source" | "move-source" | "move-folder" | "delete";

type ActionOption = {
	value: ActionType;
	label: string;
};

function isActionType(value: string): value is ActionType {
	return (
		value === "copy-source" ||
		value === "move-source" ||
		value === "move-folder" ||
		value === "delete"
	);
}

export function BulkActionDialog(props: BulkActionDialogProps) {
	const [form, setForm] = createSignal<HTMLFormElement>();
	const [action, setAction] = createSignal<ActionType>("copy-source");
	const [targetSourceId, setTargetSourceId] = createSignal("");
	const [destinationPath, setDestinationPath] = createSignal("");
	const [isSubmitting, setIsSubmitting] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal("");
	const [retryCommand, setRetryCommand] =
		createSignal<BulkActionCommand | null>(null);
	const [uncertainItems, setUncertainItems] = createSignal<BulkActionItem[]>(
		[],
	);
	const isTargetSourceAction = () =>
		action() === "copy-source" || action() === "move-source";
	createEffect(() => {
		if (!props.open && !isSubmitting()) {
			setTargetSourceId("");
			setDestinationPath("");
			setRetryCommand(null);
			setUncertainItems([]);
			setErrorMsg("");
		}
	});

	const sourceList = useMediaDestinationSources(
		() => props.open && isTargetSourceAction(),
		props.listSources,
	);

	const selectedItems = () => {
		const sourceId = props.mediaSourceId;
		return (
			props.mediaItems ??
			(sourceId
				? props.mediaIds.map((mediaId) => ({
						mediaId,
						mediaSourceId: sourceId,
					}))
				: [])
		);
	};
	const selectedSourceIds = () =>
		new Set(selectedItems().map((item) => item.mediaSourceId));
	const usableSources = () => {
		const excluded = selectedSourceIds();
		return sourceList.sources().filter((source) => !excluded.has(source.id));
	};
	const actionOptions = (): ActionOption[] => [
		{ value: "copy-source", label: t("bulkActionDialog.copyToAnotherSource") },
		{ value: "move-source", label: t("bulkActionDialog.moveToAnotherSource") },
		{
			value: "move-folder",
			label: t("bulkActionDialog.moveFolderWithinThisSource"),
		},
		{ value: "delete", label: t("bulkActionDialog.bulkDelete") },
	];
	const selectedActionOption = () =>
		actionOptions().find((option) => option.value === action()) ?? null;
	const selectedTargetSource = () =>
		usableSources().find((source) => source.id === targetSourceId());
	const canSubmit = () => {
		if (isSubmitting()) return false;
		const retry = retryCommand();
		if (retry) return retry.items.length > 0;
		if (!selectedItems().length) return false;
		if (isTargetSourceAction()) {
			return !sourceList.loading() && Boolean(selectedTargetSource());
		}
		return action() === "delete" || Boolean(destinationPath().trim());
	};

	const handleConfirm = async () => {
		if (!canSubmit()) return;
		setIsSubmitting(true);
		setErrorMsg("");
		try {
			const command =
				retryCommand() ??
				createBulkActionCommand({
					action: action(),
					items: selectedItems(),
					targetSourceId: selectedTargetSource()?.id ?? "",
					destinationPath: destinationPath(),
				});
			const outcome = await executeBulkActionCommand(command, props);
			const unknown = [...uncertainItems(), ...outcome.uncertainItems];
			setUncertainItems(unknown);
			const partial = outcome.retryItems.length > 0 || unknown.length > 0;
			props.onSuccess(partial, outcome.succeededMediaIds);
			if (partial) {
				setRetryCommand({ ...command, items: outcome.retryItems });
				setErrorMsg(
					t(
						"bulkActionDialog.valueSucceededValueCanBeRetriedValueHaveUnknown",
						{
							value0: String(outcome.succeededMediaIds.length),
							value1: String(outcome.retryItems.length),
							value2: String(unknown.length),
						},
					) +
						(unknown.length
							? t(
									"bulkActionDialog.doNotResubmitItemsWithUnknownOutcomesCloseThe",
								)
							: t(
									"bulkActionDialog.onlyFailedOrUnprocessedItemsCanBeRetriedTo",
								)),
				);
			} else {
				setRetryCommand(null);
				props.onOpenChange(false);
			}
		} catch (error) {
			setErrorMsg(
				error instanceof Error ? error.message : t("feedback.unexpectedError"),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog
			open={props.open}
			onOpenChange={(open) => {
				if (!isSubmitting()) props.onOpenChange(open);
			}}
		>
			<DialogContent
				class="workspace-theme sm:max-w-dialog-xs"
				closeDisabled={isSubmitting()}
			>
				<DialogHeader>
					<DialogTitle>{t("searchScreen.runBulkAction")}</DialogTitle>
					<DialogDescription>
						{t("bulkActionDialog.runABulkActionOnValueValueSelectedMedia", {
							value0: String(selectedItems().length),
						})}
					</DialogDescription>
				</DialogHeader>

				<form
					class="grid gap-4"
					ref={setForm}
					onSubmit={(event) => {
						event.preventDefault();
						void handleConfirm();
					}}
				>
					<Select<ActionOption>
						class="flex flex-col gap-2"
						disabled={isSubmitting() || retryCommand() !== null}
						disallowEmptySelection
						itemComponent={(itemProps) => (
							<SelectItem item={itemProps.item}>
								{itemProps.item.rawValue.label}
							</SelectItem>
						)}
						onChange={(option) => {
							if (option && isActionType(option.value)) {
								setAction(option.value);
							}
						}}
						options={actionOptions()}
						optionTextValue="label"
						optionValue="value"
						value={selectedActionOption()}
					>
						<SelectLabel>{t("jobsScreen.chooseAction")}</SelectLabel>
						<SelectTrigger class="w-full" id="bulk-action-type">
							<SelectValue<ActionOption>>
								{(state) => state.selectedOption()?.label ?? ""}
							</SelectValue>
						</SelectTrigger>
						<SelectContent portalMount={form()} />
					</Select>

					<Show when={isTargetSourceAction()}>
						<MediaDestinationField
							options={usableSources()}
							value={selectedTargetSource()}
							onChange={setTargetSourceId}
							disabled={isSubmitting() || retryCommand() !== null}
							loading={sourceList.loading()}
							failed={sourceList.failed()}
							onRetry={sourceList.retry}
							id="target-source-id"
						/>
					</Show>

					<Show when={action() === "move-folder"}>
						<div class="flex flex-col gap-2 font-medium text-sm">
							<span id="destination-path-label">
								{t("bulkActionDialog.destinationFolderPath")}
							</span>
							<Input
								aria-labelledby="destination-path-label"
								id="destination-path"
								disabled={isSubmitting() || retryCommand() !== null}
								placeholder={t("bulkActionDialog.eGSubfolderNewDir")}
								value={destinationPath()}
								onInput={(event) =>
									setDestinationPath(event.currentTarget.value)
								}
							/>
						</div>
					</Show>

					<Show when={action() === "delete"}>
						<Alert variant="destructive">
							<AlertDescription>
								{t(
									"bulkActionDialog.warningThisActionCannotBeUndoneTheActualFiles",
								)}
							</AlertDescription>
						</Alert>
					</Show>

					<Show when={errorMsg()}>
						<Alert variant="destructive">
							<AlertDescription>{errorMsg()}</AlertDescription>
						</Alert>
					</Show>
					<DialogFooter>
						<Button
							disabled={isSubmitting()}
							onClick={() => props.onOpenChange(false)}
							type="button"
							variant="outline"
						>
							{t("actions.cancel")}
						</Button>
						<Button
							aria-busy={isSubmitting()}
							disabled={!canSubmit()}
							type="submit"
							variant={action() === "delete" ? "destructive" : "default"}
						>
							{isSubmitting()
								? t("status.processing")
								: retryCommand()
									? t("bulkActionDialog.retryFailedOrUnprocessedItems")
									: t("bulkActionDialog.confirm")}
						</Button>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
}
