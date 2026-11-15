import { t } from "@solid-imager/i18n";
import type { Ip } from "@solid-imager/core/ips";
import { createSignal, For, Show } from "solid-js";
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
} from "../../combobox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "../../dialog";
import type { UseManagerPageResult } from "../../hooks/use-manager-page";
import { Input } from "../../input";
import { Label } from "../../label";
import { isCharacter, singularLabel } from "./utils";

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
	const requestFormClose = () => {
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
						if (!entityFormIsDirty(props.manager)) return;
						event.preventDefault();
						setDiscardDialogOpen(true);
					}}
					onPointerDownOutside={(event) => {
						if (!entityFormIsDirty(props.manager)) return;
						event.preventDefault();
						setDiscardDialogOpen(true);
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
					<div class="grid gap-4 py-2">
						<div class="space-y-1.5">
							<Label for="manager-entity-name">{t("labels.name")}</Label>
							<Input
								id="manager-entity-name"
								onInput={(event) =>
									props.manager.setFormData({
										...props.manager.formData(),
										name: event.currentTarget.value,
									})
								}
								value={props.manager.formData().name}
							/>
						</div>
						<div class="space-y-1.5">
							<Label for="manager-entity-description">
								{t("labels.description")}
							</Label>
							<Input
								id="manager-entity-description"
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
							<div class="space-y-1.5">
								<Label for="manager-entity-ips">{t("labels.ips")}</Label>
								<Combobox<Ip>
									itemComponent={(comboboxProps) => (
										<ComboboxItem item={comboboxProps.item}>
											<ComboboxItemLabel>
												{comboboxProps.item.rawValue.name}
											</ComboboxItemLabel>
											<ComboboxItemIndicator />
										</ComboboxItem>
									)}
									multiple
									onChange={(values) =>
										props.manager.setFormData({
											...props.manager.formData(),
											ipIds: values.map((value) => value.id),
										})
									}
									optionLabel="name"
									options={props.manager.ips()}
									optionTextValue="name"
									optionValue="id"
									value={props.manager
										.ips()
										.filter((ip) =>
											props.manager.formData().ipIds?.includes(ip.id),
										)}
								>
									<ComboboxControl>
										<ComboboxInput
											id="manager-entity-ips"
											placeholder={t("dialogs.selectIPs")}
										/>
										<ComboboxTrigger />
									</ComboboxControl>
									<ComboboxContent />
								</Combobox>
							</div>
						</Show>
					</div>
					<DialogFooter>
						<Button onClick={requestFormClose} variant="outline">
							{t("actions.cancel")}
						</Button>
						<Button
							disabled={!props.manager.formData().name.trim()}
							onClick={() => {
								void props.manager.handleSave();
							}}
						>
							{t("actions.save")}
						</Button>
					</DialogFooter>
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
				onOpenChange={props.manager.setIsDeleteDialogOpen}
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
						<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => {
								void props.manager.handleConfirmDelete();
							}}
						>
							{t("actions.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<AlertDialog
				onOpenChange={props.manager.setIsDuplicateDeleteDialogOpen}
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
						<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
						<Button
							variant="destructive"
							disabled={
								props.manager.isDeletingDuplicates() ||
								props.manager.duplicatesToDelete().length === 0
							}
							onClick={() => {
								void props.manager.handleConfirmDeleteDuplicates();
							}}
						>
							{t("duplicates.deleteValue", {
								value0: String(props.manager.duplicatesToDelete().length),
							})}
						</Button>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
