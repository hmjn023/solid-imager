import { t } from "@solid-imager/i18n";
import type { Author } from "@solid-imager/core/authors";
import type { Character } from "@solid-imager/core/characters";
import type { Ip } from "@solid-imager/core/ips";
import { searchGroupSchema, type SearchGroup } from "@solid-imager/core/search";
import type { Project } from "@solid-imager/core/projects";
import type { TagResponse } from "@solid-imager/core/tags";
import { deepEqual } from "@solid-imager/core/utils";
import { createSignal } from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "./alert-dialog";
import { Button } from "./button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "./dialog";
import { ProSearchBuilder } from "./pro-search-builder";

type Props = {
	tags?: TagResponse[];
	projects?: Project[];
	ips?: Ip[];
	characters?: Character[];
	authors?: Author[];
	value: SearchGroup | null;
	onChange: (value: SearchGroup | null) => void;
	onSearch?: () => void;
};

function cloneSearchGroup(group: SearchGroup | null): SearchGroup | null {
	if (!group) return null;
	return searchGroupSchema.parse(JSON.parse(JSON.stringify(group)));
}

export function ProSearchDialog(props: Props) {
	const [open, setOpen] = createSignal(false);
	const [draft, setDraft] = createSignal<SearchGroup | null>(
		cloneSearchGroup(props.value),
	);
	const [confirmDiscard, setConfirmDiscard] = createSignal(false);

	const isDirty = () => !deepEqual(draft(), cloneSearchGroup(props.value));
	const handleOpen = () => {
		setDraft(cloneSearchGroup(props.value));
		setConfirmDiscard(false);
		setOpen(true);
	};
	const requestClose = () => {
		if (isDirty()) {
			setConfirmDiscard(true);
			return;
		}
		setOpen(false);
	};

	return (
		<>
			<Dialog
				onOpenChange={(next) => (next ? handleOpen() : requestClose())}
				open={open()}
			>
				<DialogTrigger
					as={Button}
					class="min-h-11 w-full sm:min-h-9"
					variant="outline"
				>
					{t("proSearchDialog.editAdvancedConditions")}
				</DialogTrigger>
				<DialogContent class="flex max-h-dialog-safe max-w-5xl flex-col">
					<DialogHeader>
						<DialogTitle>
							{t("proSearchDialog.editAdvancedSearchConditions")}
						</DialogTitle>
						<DialogDescription class="sr-only">
							{t("proSearchDialog.editAdvancedConditions")}
						</DialogDescription>
					</DialogHeader>
					<div class="flex-1 overflow-y-auto overscroll-contain p-1">
						<ProSearchBuilder
							authors={props.authors}
							characters={props.characters}
							ips={props.ips}
							onChange={setDraft}
							projects={props.projects}
							tags={props.tags}
							value={draft()}
						/>
					</div>
					<DialogFooter>
						<Button
							class="min-h-11 sm:min-h-9"
							onClick={requestClose}
							type="button"
							variant="outline"
						>
							{t("actions.cancel")}
						</Button>
						<Button
							class="min-h-11 sm:min-h-9"
							onClick={() => {
								props.onChange(draft());
								props.onSearch?.();
								setOpen(false);
							}}
							type="button"
						>
							{props.onSearch ? t("actions.search") : t("proSearchDialog.done")}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog
				onOpenChange={setConfirmDiscard}
				open={open() && confirmDiscard()}
			>
				<AlertDialogContent class="workspace-theme rounded-lg sm:max-w-dialog-xs">
					<AlertDialogHeader>
						<AlertDialogTitle>
							{t("proSearchDialog.discardChangesTitle")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("proSearchDialog.discardChangesDescription")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel class="min-h-11 sm:min-h-9">
							{t("configScreen.keepEditing")}
						</AlertDialogCancel>
						<AlertDialogAction
							class="min-h-11 sm:min-h-9"
							onClick={() => {
								setConfirmDiscard(false);
								setOpen(false);
							}}
							variant="destructive"
						>
							{t("actions.discard")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
