import { useRenderedSearchState } from "./search-initial-state";
import { t } from "@solid-imager/i18n";
import {
	type MediaSort,
	type SearchGroup,
	searchGroupSchema,
	getSearchConditionFromState,
	preparePresetState,
	defaultState,
	type SearchState,
} from "@solid-imager/core/search";
import { type Preset } from "@solid-imager/core/presets";
import Trash2 from "lucide-solid/icons/trash";
import { deepEqual } from "@solid-imager/core/utils";
import { createEffect, createResource, createSignal, Show } from "solid-js";
import type { SetStoreFunction } from "solid-js/store";
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
import { FormError } from "./form-message";
import { Input } from "./input";
import { Label } from "./label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { setSearchState } from "./stores/search-store";
import { toast } from "./toast";
import { cn } from "./utils/cn";

export interface PresetManagerClient {
	list(): Promise<Preset[]>;
	create(data: {
		name: string;
		value: SearchGroup;
		sort?: MediaSort;
		order?: "asc" | "desc";
		mode?: "simple" | "pro";
	}): Promise<unknown>;
	delete(id: number): Promise<unknown>;
}

type PresetManagerProps = {
	presetClient: PresetManagerClient;
	class?: string;
	onAction?: () => void;
	state?: SearchState;
	setState?: SetStoreFunction<SearchState>;
};

function normalizeSearchCondition(condition: SearchGroup | undefined) {
	return searchGroupSchema.parse(
		condition ?? {
			type: "group",
			operator: "and",
			children: [],
		},
	);
}

function createClearedSearchState(state: SearchState): SearchState {
	return {
		...defaultState,
		mode: state.mode,
		selectedSource: state.selectedSource,
		sortBy: state.sortBy,
		sortOrder: state.sortOrder,
		tagMode: state.tagMode,
	};
}

export function PresetManager(props: PresetManagerProps) {
	const [data, { refetch }] = createResource(() => props.presetClient.list());
	const renderedState = useRenderedSearchState();
	const currentState = () => props.state ?? renderedState();
	const updateState = props.setState ?? setSearchState;

	const presets = () =>
		data()?.filter((preset) => !preset.name.startsWith("current"));

	createEffect(() => {
		const availablePresets = presets();
		const state = currentState();
		if (!availablePresets || state.activePresetId !== null) {
			return;
		}
		const condition = normalizeSearchCondition(
			getSearchConditionFromState(state),
		);
		const matchingPreset = availablePresets.find((preset) =>
			deepEqual(normalizeSearchCondition(preset.value), condition),
		);
		if (matchingPreset) {
			updateState("activePresetId", matchingPreset.id);
		}
	});

	const [isSaveDialogOpen, setIsSaveDialogOpen] = createSignal(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [presetToDelete, setPresetToDelete] = createSignal<number | null>(null);
	const [newPresetName, setNewPresetName] = createSignal("");
	const [isSaving, setIsSaving] = createSignal(false);
	const [saveError, setSaveError] = createSignal<string | null>(null);
	const [isDeleting, setIsDeleting] = createSignal(false);
	const [deleteError, setDeleteError] = createSignal<string | null>(null);
	const [selectedPresetId, setSelectedPresetId] = createSignal<string | null>(
		null,
	);

	createEffect(() => {
		const active = currentState().activePresetId;
		if (active) {
			setSelectedPresetId(String(active));
		} else {
			setSelectedPresetId(null);
		}
	});

	const handleSave = async (event: Event) => {
		event.preventDefault();
		const trimmedName = newPresetName().trim();
		if (isSaving() || !trimmedName) {
			return;
		}

		const state = currentState();
		const condition = getSearchConditionFromState(state);
		if (!condition) {
			setSaveError(t("presetManager.noSearchConditions"));
			return;
		}

		setSaveError(null);
		setIsSaving(true);
		try {
			await props.presetClient.create({
				name: trimmedName,
				value: condition,
				sort: state.sortBy,
				order: state.sortOrder,
				mode: state.mode === "simple" ? "simple" : "pro",
			});
			setIsSaveDialogOpen(false);
			setNewPresetName("");
			void refetch();
			toast.success(t("presetManager.presetSaved"));
			props.onAction?.();
		} catch {
			setSaveError(t("presetManager.couldNotSavePreset"));
			toast.error(t("presetManager.couldNotSavePreset"));
		} finally {
			setIsSaving(false);
		}
	};

	const confirmDelete = (id: number) => {
		setPresetToDelete(id);
		setDeleteError(null);
		setIsDeleteDialogOpen(true);
	};

	const executeDelete = async () => {
		const id = presetToDelete();
		if (!id || isDeleting()) {
			return;
		}

		setDeleteError(null);
		setIsDeleting(true);
		try {
			await props.presetClient.delete(id);
			if (selectedPresetId() === String(id)) {
				setSelectedPresetId(null);
			}
			void refetch();
			setIsDeleteDialogOpen(false);
			setPresetToDelete(null);
		} catch {
			setDeleteError(t("presetManager.couldNotDeletePreset"));
			toast.error(t("presetManager.couldNotDeletePreset"));
		} finally {
			setIsDeleting(false);
		}
	};

	const handleLoad = () => {
		const id = selectedPresetId();
		if (!id) {
			return;
		}
		const preset = presets()?.find((item: Preset) => item.id === Number(id));
		if (preset) {
			updateState(preparePresetState(preset, currentState()));
			props.onAction?.();
		}
	};

	const handleClearSelection = () => {
		setSelectedPresetId(null);
		updateState(createClearedSearchState(currentState()));
		props.onAction?.();
	};

	return (
		<div class={cn("flex w-full flex-col gap-2", props.class)}>
			<AlertDialog
				onOpenChange={(open) => {
					if (!isDeleting()) {
						setIsDeleteDialogOpen(open);
						if (!open) {
							setPresetToDelete(null);
							setDeleteError(null);
						}
					}
				}}
				open={isDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("actions.deletePreset")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("presetManager.deleteThisPresetThisActionCannotBeUndone")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<FormError message={deleteError()} />
					<AlertDialogFooter>
						<AlertDialogCancel
							class="min-h-11 sm:min-h-9"
							disabled={isDeleting()}
						>
							{t("actions.cancel")}
						</AlertDialogCancel>
						<AlertDialogAction
							aria-busy={isDeleting()}
							class="min-h-11 sm:min-h-9"
							disabled={isDeleting()}
							onClick={(event) => {
								event.preventDefault();
								void executeDelete();
							}}
							variant="destructive"
						>
							{isDeleting() ? t("status.deleting") : t("actions.delete")}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<div class="flex items-center gap-2">
				<div class="min-w-0 flex-1">
					<Select<string>
						itemComponent={(itemProps) => {
							const preset = presets()?.find(
								(item: Preset) => String(item.id) === itemProps.item.rawValue,
							);
							return (
								<SelectItem
									class="flex w-full justify-between gap-2"
									item={itemProps.item}
								>
									<span>{preset?.name}</span>
								</SelectItem>
							);
						}}
						onChange={setSelectedPresetId}
						options={
							presets()?.map((preset: Preset) => String(preset.id)) || []
						}
						placeholder={t("presetManager.selectAPreset")}
						value={selectedPresetId()}
					>
						<SelectTrigger
							aria-label={t("presetManager.selectAPreset")}
							class="w-full"
						>
							<SelectValue<string>>
								{(state) => {
									const preset = presets()?.find(
										(item: Preset) =>
											String(item.id) === state.selectedOption(),
									);
									return (
										<span class="truncate">
											{preset ? preset.name : t("presetManager.selectAPreset")}
										</span>
									);
								}}
							</SelectValue>
						</SelectTrigger>
						<SelectContent />
					</Select>
				</div>

				<Show when={selectedPresetId()}>
					<Button
						aria-label={t("actions.clearSelection")}
						class="size-11 shrink-0 sm:size-9"
						onClick={handleClearSelection}
						size="icon"
						title={t("actions.clearSelection")}
						variant="ghost"
					>
						<svg
							class="size-4"
							fill="none"
							height="16"
							stroke="currentColor"
							stroke-linecap="round"
							stroke-linejoin="round"
							stroke-width="2"
							viewBox="0 0 24 24"
							width="16"
							xmlns="http://www.w3.org/2000/svg"
						>
							<title>{t("actions.clearSelection")}</title>
							<path d="M18 6 6 18" />
							<path d="m6 6 12 12" />
						</svg>
					</Button>
				</Show>
			</div>

			<div class="flex w-full items-center gap-2">
				<Button
					class="min-h-11 flex-1 sm:min-h-9"
					disabled={!selectedPresetId()}
					onClick={handleLoad}
					variant="outline"
				>
					{t("presetManager.load")}
				</Button>

				<Dialog
					onOpenChange={(open) => {
						if (!isSaving()) {
							setIsSaveDialogOpen(open);
							if (!open) setSaveError(null);
						}
					}}
					open={isSaveDialogOpen()}
				>
					<DialogTrigger
						as={Button}
						class="min-h-11 flex-1 sm:min-h-9"
						variant="secondary"
					>
						{t("actions.save")}
					</DialogTrigger>
					<DialogContent closeDisabled={isSaving()}>
						<DialogHeader>
							<DialogTitle>
								{t("presetManager.saveCurrentSearchConditions")}
							</DialogTitle>
							<DialogDescription>
								{t("presetManager.nameAndSaveTheCurrentSearchConditions")}
							</DialogDescription>
						</DialogHeader>
						<form
							class="grid gap-4"
							onSubmit={(event) => {
								void handleSave(event);
							}}
						>
							<div class="grid gap-2 sm:grid-cols-4 sm:items-center sm:gap-4">
								<Label class="sm:text-right" for="preset-save-name">
									{t("labels.name")}
								</Label>
								<Input
									class="sm:col-span-3"
									disabled={isSaving()}
									id="preset-save-name"
									onInput={(event) => {
										setNewPresetName(event.currentTarget.value);
										if (saveError()) setSaveError(null);
									}}
									value={newPresetName()}
								/>
							</div>
							<FormError message={saveError()} />
							<DialogFooter>
								<Button
									class="min-h-11 sm:min-h-9"
									disabled={isSaving()}
									onClick={() => setIsSaveDialogOpen(false)}
									type="button"
									variant="outline"
								>
									{t("actions.cancel")}
								</Button>
								<Button
									aria-busy={isSaving()}
									class="min-h-11 sm:min-h-9"
									disabled={isSaving() || !newPresetName().trim()}
									type="submit"
								>
									{isSaving() ? t("status.saving") : t("actions.save")}
								</Button>
							</DialogFooter>
						</form>
					</DialogContent>
				</Dialog>

				<Show when={selectedPresetId()}>
					<Button
						aria-label={t("actions.deletePreset")}
						class="size-11 shrink-0 border-destructive/40 text-destructive hover:bg-destructive hover:text-destructive-foreground sm:size-9"
						disabled={isDeleting()}
						onClick={() => confirmDelete(Number(selectedPresetId()))}
						size="icon"
						title={t("actions.deletePreset")}
						variant="outline"
					>
						<Trash2 aria-hidden="true" class="size-4" />
					</Button>
				</Show>
			</div>
		</div>
	);
}
