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
import { Input } from "./input";
import { Label } from "./label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { searchState, setSearchState } from "./stores/search-store";
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
	const currentState = () => props.state ?? searchState;
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
		if (!newPresetName()) {
			return;
		}

		const state = currentState();
		const condition = getSearchConditionFromState(state);
		if (!condition) {
			toast.error(t("presetManager.noSearchConditions"));
			return;
		}

		try {
			await props.presetClient.create({
				name: newPresetName(),
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
			toast.error(t("presetManager.couldNotSavePreset"));
		}
	};

	const confirmDelete = (id: number) => {
		setPresetToDelete(id);
		setIsDeleteDialogOpen(true);
	};

	const executeDelete = async () => {
		const id = presetToDelete();
		if (!id) {
			return;
		}

		try {
			await props.presetClient.delete(id);
			if (selectedPresetId() === String(id)) {
				setSelectedPresetId(null);
			}
			void refetch();
		} catch {
			toast.error(t("presetManager.couldNotDeletePreset"));
		} finally {
			setIsDeleteDialogOpen(false);
			setPresetToDelete(null);
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
				onOpenChange={setIsDeleteDialogOpen}
				open={isDeleteDialogOpen()}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>{t("actions.deletePreset")}</AlertDialogTitle>
						<AlertDialogDescription>
							{t("presetManager.deleteThisPresetThisActionCannotBeUndone")}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
						<AlertDialogAction
							class="bg-error0 hover:bg-destructive"
							onClick={() => {
								void executeDelete();
							}}
						>
							{t("actions.delete")}
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
						<SelectTrigger class="w-full">
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
						class="h-10 w-10 shrink-0"
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
					class="flex-1"
					disabled={!selectedPresetId()}
					onClick={handleLoad}
					variant="outline"
				>
					{t("presetManager.load")}
				</Button>

				<Dialog onOpenChange={setIsSaveDialogOpen} open={isSaveDialogOpen()}>
					<DialogTrigger as={Button} class="flex-1" variant="secondary">
						{t("actions.save")}
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>
								{t("presetManager.saveCurrentSearchConditions")}
							</DialogTitle>
							<DialogDescription>
								{t("presetManager.nameAndSaveTheCurrentSearchConditions")}
							</DialogDescription>
						</DialogHeader>
						<div class="grid gap-4 py-4">
							<div class="grid grid-cols-4 items-center gap-4">
								<Label class="text-right">{t("labels.name")}</Label>
								<Input
									class="col-span-3"
									onInput={(event) =>
										setNewPresetName(event.currentTarget.value)
									}
									value={newPresetName()}
								/>
							</div>
						</div>
						<DialogFooter>
							<Button
								onClick={(event) => {
									void handleSave(event);
								}}
							>
								{t("actions.save")}
							</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<Show when={selectedPresetId()}>
					<Button
						class="hover:border-error hover:bg-error"
						onClick={() => confirmDelete(Number(selectedPresetId()))}
						size="icon"
						title={t("actions.deletePreset")}
						variant="outline"
					>
						<Trash2 class="size-4 text-destructive" />
					</Button>
				</Show>
			</div>
		</div>
	);
}
