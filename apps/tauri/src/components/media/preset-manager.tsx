import type { SearchGroup } from "@solid-imager/core/domain/media/schemas";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@solid-imager/ui/alert-dialog";
import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@solid-imager/ui/dialog";
import { Input } from "@solid-imager/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import { toast } from "@solid-imager/ui/toast";
import { createMemo, createSignal, Show } from "solid-js";
import { cloneSearchGroup } from "../../lib/mock-pro-search";
import type { TauriSearchMode } from "./search-control-panel";
import type { TauriSearchFilterState } from "./search-filters";

type MockPreset = {
	id: number;
	name: string;
	mode: TauriSearchMode;
	advancedCondition: SearchGroup | null;
	state: TauriSearchFilterState;
};

type PresetManagerProps = {
	currentMode: TauriSearchMode;
	currentState: TauriSearchFilterState;
	advancedCondition: SearchGroup | null;
	onLoadPreset: (preset: MockPreset) => void;
	class?: string;
	onAction?: () => void;
};

function cloneState(state: TauriSearchFilterState): TauriSearchFilterState {
	return {
		...state,
		excludeTags: [...state.excludeTags],
		selectedAuthors: [...state.selectedAuthors],
		selectedCharacters: [...state.selectedCharacters],
		selectedIps: [...state.selectedIps],
		selectedProjects: [...state.selectedProjects],
		selectedTags: [...state.selectedTags],
	};
}

export function PresetManager(props: PresetManagerProps) {
	const [presets, setPresets] = createSignal<MockPreset[]>([
		{
			id: 1,
			name: "レビュー待ち",
			mode: "simple",
			advancedCondition: null,
			state: {
				searchQuery: "",
				selectedTags: [],
				excludeTags: [],
				selectedProjects: [],
				selectedIps: [],
				selectedCharacters: [],
				selectedAuthors: [],
				selectedStatus: "review",
				favoritesOnly: false,
				sortBy: "date",
				sortOrder: "desc",
			},
		},
		{
			id: 2,
			name: "nova tagged",
			mode: "pro",
			advancedCondition: {
				type: "group",
				operator: "and",
				children: [
					{
						type: "criterion",
						target: "author",
						operator: "equals",
						value: "author-nova",
					},
					{
						type: "criterion",
						target: "favorite",
						operator: "equals",
						value: true,
					},
				],
			},
			state: {
				searchQuery: "",
				selectedTags: [],
				excludeTags: [],
				selectedProjects: [],
				selectedIps: [],
				selectedCharacters: [],
				selectedAuthors: ["author-nova"],
				selectedStatus: null,
				favoritesOnly: true,
				sortBy: "rating",
				sortOrder: "desc",
			},
		},
	]);
	const [isSaveDialogOpen, setIsSaveDialogOpen] = createSignal(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [presetToDelete, setPresetToDelete] = createSignal<number | null>(null);
	const [selectedPresetId, setSelectedPresetId] = createSignal<string | null>(
		null,
	);
	const [newPresetName, setNewPresetName] = createSignal("");

	const selectedPreset = createMemo(() =>
		presets().find((preset) => String(preset.id) === selectedPresetId()),
	);

	const handleSave = (event: Event) => {
		event.preventDefault();
		if (!newPresetName().trim()) {
			return;
		}

		setPresets((current) => [
			...current,
			{
				id: Date.now(),
				name: newPresetName().trim(),
				mode: props.currentMode,
				advancedCondition: cloneSearchGroup(props.advancedCondition),
				state: cloneState(props.currentState),
			},
		]);
		setNewPresetName("");
		setIsSaveDialogOpen(false);
		toast.success("プリセットを保存しました");
		props.onAction?.();
	};

	const executeDelete = () => {
		const targetId = presetToDelete();
		if (!targetId) {
			return;
		}

		setPresets((current) => current.filter((preset) => preset.id !== targetId));
		if (selectedPresetId() === String(targetId)) {
			setSelectedPresetId(null);
		}
		setPresetToDelete(null);
		setIsDeleteDialogOpen(false);
		toast.success("プリセットを削除しました");
		props.onAction?.();
	};

	return (
		<div class={props.class}>
			<div class="flex w-full flex-col gap-2">
				<AlertDialog
					onOpenChange={setIsDeleteDialogOpen}
					open={isDeleteDialogOpen()}
				>
					<AlertDialogContent>
						<AlertDialogHeader>
							<AlertDialogTitle>プリセットの削除</AlertDialogTitle>
							<AlertDialogDescription>
								本当にこのプリセットを削除しますか？この操作は取り消せません。
							</AlertDialogDescription>
						</AlertDialogHeader>
						<AlertDialogFooter>
							<AlertDialogCancel>キャンセル</AlertDialogCancel>
							<AlertDialogAction
								class="bg-red-500 hover:bg-red-600"
								onClick={executeDelete}
							>
								削除する
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>

				<div class="flex items-center gap-2">
					<div class="min-w-0 flex-1">
						<Select
							itemComponent={(itemProps) => {
								const preset = presets().find(
									(candidate) =>
										String(candidate.id) ===
										(itemProps.item.rawValue as string),
								);
								return (
									<SelectItem item={itemProps.item}>
										<span>{preset?.name}</span>
									</SelectItem>
								);
							}}
							onChange={setSelectedPresetId}
							options={presets().map((preset) => String(preset.id))}
							placeholder="プリセットを選択..."
							value={selectedPresetId()}
						>
							<SelectTrigger class="w-full">
								<SelectValue<string>>
									{(state) => {
										const preset = presets().find(
											(candidate) =>
												String(candidate.id) ===
												(state.selectedOption() as string),
										);
										return preset ? preset.name : "プリセットを選択...";
									}}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>
					<Show when={selectedPresetId()}>
						<Button
							class="h-10 w-10 shrink-0"
							onClick={() => setSelectedPresetId(null)}
							size="icon"
							title="選択解除"
							variant="ghost"
						>
							×
						</Button>
					</Show>
				</div>

				<div class="flex w-full items-center gap-2">
					<Button
						class="flex-1"
						disabled={!selectedPreset()}
						onClick={() => {
							const preset = selectedPreset();
							if (!preset) {
								return;
							}
							props.onLoadPreset({
								...preset,
								advancedCondition: cloneSearchGroup(preset.advancedCondition),
								state: cloneState(preset.state),
							});
							toast.success("プリセットを読み込みました");
							props.onAction?.();
						}}
						variant="outline"
					>
						読込
					</Button>

					<Dialog onOpenChange={setIsSaveDialogOpen} open={isSaveDialogOpen()}>
						<DialogTrigger as={Button} class="flex-1" variant="secondary">
							保存
						</DialogTrigger>
						<DialogContent>
							<DialogHeader>
								<DialogTitle>プリセットの保存</DialogTitle>
							</DialogHeader>
							<form class="space-y-4" onSubmit={handleSave}>
								<Input
									onInput={(event) =>
										setNewPresetName(event.currentTarget.value)
									}
									placeholder="プリセット名"
									value={newPresetName()}
								/>
								<DialogFooter>
									<Button type="submit">保存</Button>
								</DialogFooter>
							</form>
						</DialogContent>
					</Dialog>

					<Button
						class="flex-1"
						disabled={!selectedPreset()}
						onClick={() => {
							const preset = selectedPreset();
							if (preset) {
								setPresetToDelete(preset.id);
								setIsDeleteDialogOpen(true);
							}
						}}
						variant="destructive"
					>
						削除
					</Button>
				</div>
			</div>
		</div>
	);
}
