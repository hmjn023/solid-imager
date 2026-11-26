import { t } from "@solid-imager/i18n";
import { createMemo, createSignal, For, Show } from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "../../alert-dialog";
import { Button } from "../../button";
import {
	Combobox,
	ComboboxContent,
	ComboboxControl,
	ComboboxInput,
	ComboboxItem,
	ComboboxItemIndicator,
	ComboboxItemLabel,
	ComboboxTrigger,
	useComboboxContext,
} from "../../combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../../dialog";
import { FormError } from "../../form-message";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Input } from "../../input";
import { Label } from "../../label";
import { SelectedRelationItems } from "../../selected-relation-items";
import { isCharacter, singularLabel } from "./utils";

type IpOption = { id: string; name: string };

function IpPickerInput() {
	const combobox = useComboboxContext();
	return (
		<ComboboxInput
			id="manager-entity-ips"
			placeholder={t("dialogs.selectIPs")}
			onKeyDown={(event: KeyboardEvent) => {
				if (event.key === "Enter" && !combobox.isOpen() && !event.isComposing)
					event.preventDefault();
				if (event.key !== "Escape" || !combobox.isOpen()) return;
				event.preventDefault();
				event.stopPropagation();
				combobox.setInputValue("");
				combobox.close();
			}}
		/>
	);
}

function entityFormIsDirty(manager: UseManagerPageResult): boolean {
	const form = manager.formData();
	const editing = manager.editingItem();
	if (!editing) {
		return (
			form.name.trim().length > 0 ||
			form.description.trim().length > 0 ||
			(form.ipIds?.length ?? 0) > 0
		);
	}
	const originalIpIds = isCharacter(editing)
		? editing.ips.map((ip) => ip.id).sort()
		: [];
	const currentIpIds = [...(form.ipIds ?? [])].sort();
	return (
		form.name !== editing.name ||
		form.description !== (editing.description ?? "") ||
		originalIpIds.join("|") !== currentIpIds.join("|")
	);
}

export function ManagerDialogs(props: { manager: UseManagerPageResult }) {
	const [discardDialogOpen, setDiscardDialogOpen] = createSignal(false);
	let ipField: HTMLDivElement | undefined;
	const availableIps = createMemo(() => {
		const editing = props.manager.editingItem();
		const linkedIps = editing && isCharacter(editing) ? editing.ips : [];
		return [
			...new Map(
				[...linkedIps, ...props.manager.ips()].map((ip) => [ip.id, ip]),
			).values(),
		];
	});
	const selectedIps = createMemo(() => {
		const ipIds = props.manager.formData().ipIds ?? [];
		return availableIps().filter((ip) => ipIds.includes(ip.id));
	});
	const setSelectedIps = (ips: IpOption[]) => {
		props.manager.setFormData((data) => ({
			...data,
			ipIds: ips.map((ip) => ip.id),
		}));
	};
	const requestFormClose = () => {
		if (props.manager.isSavingEntity()) return;
		if (entityFormIsDirty(props.manager)) {
			setDiscardDialogOpen(true);
			return;
		}
		props.manager.setIsDialogOpen(false);
	};
	const handleFormOpenChange = (open: boolean) => {
		if (open) {
			props.manager.setIsDialogOpen(true);
			return;
		}
		requestFormClose();
	};

	return (
		<>
			<Dialog
				onOpenChange={handleFormOpenChange}
				open={props.manager.isDialogOpen()}
			>
				<DialogContent
					onEscapeKeyDown={(event) => {
						event.preventDefault();
						requestFormClose();
					}}
					onPointerDownOutside={(event) => {
						event.preventDefault();
						requestFormClose();
					}}
				>
					<DialogHeader>
						<DialogTitle>
							{t(
								props.manager.editingItem()
									? "manager.editTitle"
									: "manager.createTitle",
								{ item: singularLabel(props.manager.activeTab()) },
							)}
						</DialogTitle>
						<DialogDescription>
							{props.manager.editingItem()
								? t("dialogs.updateThisItemWithoutLeavingTheManagerContext")
								: t("dialogs.addANewItemToTheCurrentCategory")}
						</DialogDescription>
					</DialogHeader>
					<form
						class="grid min-w-0 gap-4"
						onSubmit={(event) => {
							event.preventDefault();
							void props.manager.handleSave();
						}}
					>
						<div class="grid min-w-0 gap-4 py-2">
							<div class="space-y-1.5">
								<Label for="manager-entity-name">{t("labels.name")}</Label>
								<Input
									id="manager-entity-name"
									name="name"
									required
									pattern={".*\\S.*"}
									disabled={props.manager.isSavingEntity()}
									onInvalid={(event) =>
										event.currentTarget.setCustomValidity(
											t("form.nameRequired"),
										)
									}
									onInput={(event) => {
										event.currentTarget.setCustomValidity("");
										props.manager.setFormData({
											...props.manager.formData(),
											name: event.currentTarget.value,
										});
									}}
									value={props.manager.formData().name}
								/>
							</div>
							<div class="space-y-1.5">
								<Label for="manager-entity-description">
									{t("labels.description")}
								</Label>
								<Input
									id="manager-entity-description"
									name="description"
									disabled={props.manager.isSavingEntity()}
									onInput={(event) =>
										props.manager.setFormData({
											...props.manager.formData(),
											description: event.currentTarget.value,
										})
									}
									value={props.manager.formData().description}
								/>
							</div>
							<Show when={props.manager.activeTab() === "characters"}>
								<div
									class="min-w-0 space-y-2"
									ref={(element) => {
										ipField = element;
									}}
								>
									<Label for="manager-entity-ips">{t("labels.ips")}</Label>
									<Combobox<IpOption>
										name="ipIds"
										disabled={props.manager.isSavingEntity()}
										itemComponent={(comboboxProps) => (
											<ComboboxItem item={comboboxProps.item}>
												<ComboboxItemLabel>
													{comboboxProps.item.rawValue.name}
												</ComboboxItemLabel>
												<ComboboxItemIndicator />
											</ComboboxItem>
										)}
										multiple
										onChange={setSelectedIps}
										optionLabel="name"
										options={availableIps()}
										optionTextValue="name"
										optionValue="id"
										value={selectedIps()}
									>
										<ComboboxControl>
											<IpPickerInput />
											<ComboboxTrigger />
										</ComboboxControl>
										<ComboboxContent portalMount={ipField} />
									</Combobox>
									<SelectedRelationItems
										items={selectedIps()}
										disabled={props.manager.isSavingEntity()}
										onRemove={(id) =>
											props.manager.setFormData((data) => ({
												...data,
												ipIds: data.ipIds?.filter((ipId) => ipId !== id),
											}))
										}
									/>
								</div>
							</Show>
						</div>
						<FormError message={props.manager.entitySaveError()} />
						<DialogFooter>
							<Button
								type="button"
								onClick={requestFormClose}
								disabled={props.manager.isSavingEntity()}
								variant="outline"
							>
								{t("actions.cancel")}
							</Button>
							<Button
								type="submit"
								aria-busy={props.manager.isSavingEntity()}
								disabled={props.manager.isSavingEntity()}
							>
								{props.manager.isSavingEntity()
									? t("status.saving")
									: t("actions.save")}
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			<AlertDialog
				onOpenChange={setDiscardDialogOpen}
				open={discardDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("dialogs.discardUnsavedChanges")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("dialogs.theChangesInThisFormHaveNotBeenSaved")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>
							{t("configScreen.keepEditing")}
						</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								setDiscardDialogOpen(false);
								props.manager.setIsDialogOpen(false);
							}}
						>
							{t("actions.discard")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				onOpenChange={(open) => {
					if (!open && !props.manager.isDeletingEntity()) {
						props.manager.setIsDeleteDialogOpen(false);
					}
				}}
				open={props.manager.isDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("dialogs.deleteThisItem")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("dialogs.thisPermanentlyDeletesValueValue", {
								value1: String(
									props.manager.itemToDelete()?.name ?? t("dialogs.theItem"),
								),
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={props.manager.isDeletingEntity()}>
							{t("actions.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							aria-busy={props.manager.isDeletingEntity()}
							disabled={props.manager.isDeletingEntity()}
							variant="destructive"
							onClick={(event) => {
								event.preventDefault();
								void props.manager.handleConfirmDelete();
							}}
						>
							{props.manager.isDeletingEntity()
								? t("status.deleting")
								: t("actions.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				onOpenChange={(open) => {
					if (!open && !props.manager.isDeletingDuplicates()) {
						props.manager.setIsDuplicateDeleteDialogOpen(false);
					}
				}}
				open={props.manager.isDuplicateDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("dialogs.deleteDuplicateMedia")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("dialogs.thisPermanentlyDeletesValueValueMediaItems", {
								value1: String(props.manager.duplicatesToDelete().length),
							})}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div class="max-h-48 overflow-y-auto overscroll-contain text-sm">
						<For each={props.manager.duplicatesToDelete()}>
							{(item) => (
								<div class="truncate border-border border-b py-1 text-muted-foreground">
									{item.sourceName} / {item.fileName}
								</div>
							)}
						</For>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel
							class="min-h-11 sm:min-h-9"
							disabled={props.manager.isDeletingDuplicates()}
						>
							{t("actions.cancel")}
						</AlertDialogCancel>
						<Button
							aria-busy={props.manager.isDeletingDuplicates()}
							class="min-h-11 sm:min-h-9"
							variant="destructive"
							disabled={
								props.manager.isDeletingDuplicates() ||
								props.manager.duplicatesToDelete().length === 0
							}
							onClick={() => {
								void props.manager.handleConfirmDeleteDuplicates();
							}}
						>
							{props.manager.isDeletingDuplicates()
								? t("status.deleting")
								: t("duplicates.deleteValue", {
										value0: String(props.manager.duplicatesToDelete().length),
									})}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
