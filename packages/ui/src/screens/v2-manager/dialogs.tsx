import type { Ip } from "@solid-imager/core/domain/ips/schemas";
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
							{props.manager.editingItem() ? "Edit" : "Create"}{" "}
							{singularLabel(props.manager.activeTab())}
						</DialogTitle>
						<DialogDescription>
							{props.manager.editingItem()
								? "Update this item without leaving the Manager context."
								: "Add a new item to the current category."}
						</DialogDescription>
					</DialogHeader>
					<div class="grid gap-4 py-2">
						<div class="space-y-1.5">
							<Label for="v2-manager-entity-name">Name</Label>
							<Input
								id="v2-manager-entity-name"
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
							<Label for="v2-manager-entity-description">Description</Label>
							<Input
								id="v2-manager-entity-description"
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
								<Label for="v2-manager-entity-ips">IPs</Label>
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
											id="v2-manager-entity-ips"
											placeholder="Select IPs..."
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
							Cancel
						</Button>
						<Button
							disabled={!props.manager.formData().name.trim()}
							onClick={props.manager.handleSave}
						>
							Save
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
						<AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
						<AlertDialogDescription>
							The changes in this form have not been saved.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setDiscardDialogOpen(false);
								props.manager.setIsDialogOpen(false);
							}}
						>
							Discard
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
						<AlertDialogTitle>Delete this item?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes{" "}
							{props.manager.itemToDelete()?.name ?? "the item"}.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={props.manager.handleConfirmDelete}
						>
							Delete
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
						<AlertDialogTitle>Delete duplicate media?</AlertDialogTitle>
						<AlertDialogDescription>
							This permanently deletes{" "}
							{props.manager.duplicatesToDelete().length} media items.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<div class="max-h-48 overflow-y-auto overscroll-contain text-sm">
						<For each={props.manager.duplicatesToDelete()}>
							{(item) => (
								<div class="truncate border-[var(--v2-border)] border-b py-1 text-[var(--v2-text-secondary)]">
									{item.fileName}
								</div>
							)}
						</For>
					</div>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							class="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={props.manager.handleConfirmDeleteDuplicates}
						>
							Delete {props.manager.duplicatesToDelete().length}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
