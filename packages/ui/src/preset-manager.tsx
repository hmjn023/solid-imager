import type {
	Preset,
	SearchGroup,
} from "@solid-imager/core/domain/media/schemas";
import { createEffect, createResource, createSignal, Show } from "solid-js";
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
import {
	clearPresetFilters,
	getSearchCondition,
	loadPreset,
	searchState,
} from "./stores/search-store";
import { toast } from "./toast";
import { cn } from "./utils/cn";

export interface PresetManagerClient {
	list(): Promise<Preset[]>;
	create(data: {
		name: string;
		value: SearchGroup;
		sort?: "name" | "date" | "rating" | "viewCount" | "size";
		order?: "asc" | "desc";
		mode?: "simple" | "pro";
	}): Promise<unknown>;
	delete(id: number): Promise<unknown>;
}

export function PresetManager(props: {
	presetClient: PresetManagerClient;
	class?: string;
	onAction?: () => void;
}) {
	const [data, { refetch }] = createResource(props.presetClient.list);

	const presets = () => data()?.filter((p) => !p.name.startsWith("current"));

	const [isSaveDialogOpen, setIsSaveDialogOpen] = createSignal(false);
	const [isDeleteDialogOpen, setIsDeleteDialogOpen] = createSignal(false);
	const [presetToDelete, setPresetToDelete] = createSignal<number | null>(null);
	const [newPresetName, setNewPresetName] = createSignal("");
	const [selectedPresetId, setSelectedPresetId] = createSignal<string | null>(
		null,
	);

	createEffect(() => {
		const active = searchState.activePresetId;
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

		const condition = getSearchCondition();
		if (!condition) {
			toast.error("検索条件がありません");
			return;
		}

		try {
			await props.presetClient.create({
				name: newPresetName(),
				value: condition,
				sort: searchState.sortBy,
				order: searchState.sortOrder,
				mode: searchState.mode,
			});
			setIsSaveDialogOpen(false);
			setNewPresetName("");
			refetch();
			toast.success("プリセットを保存しました");
			props.onAction?.();
		} catch {
			toast.error("プリセットの保存に失敗しました");
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
			refetch();
		} catch {
			toast.error("プリセットの削除に失敗しました");
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
		const preset = presets()?.find((p: Preset) => p.id === Number(id));
		if (preset) {
			loadPreset(preset);
			props.onAction?.();
		}
	};

	const handleClearSelection = () => {
		setSelectedPresetId(null);
		clearPresetFilters();
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
					<Select<string>
						itemComponent={(itemProps) => {
							const preset = presets()?.find(
								(p: Preset) =>
									String(p.id) ===
									itemProps.item.rawValue,
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
						options={presets()?.map((p: Preset) => String(p.id)) || []}
						placeholder="プリセットを選択..."
						value={selectedPresetId()}
					>
						<SelectTrigger class="w-full">
							<SelectValue<string>>
								{(state) => {
									const preset = presets()?.find(
										(p: Preset) =>
											String(p.id) === state.selectedOption(),
									);
									return (
										<span class="truncate">
											{preset ? preset.name : "プリセットを選択..."}
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
						title="選択解除"
						variant="ghost"
					>
						<svg
							class="lucide lucide-x"
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
							<title>選択解除</title>
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
					読込
				</Button>

				<Dialog onOpenChange={setIsSaveDialogOpen} open={isSaveDialogOpen()}>
					<DialogTrigger as={Button} class="flex-1" variant="secondary">
						保存
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>現在の検索条件を保存</DialogTitle>
							<DialogDescription>
								現在の検索条件に名前を付けて保存します。
							</DialogDescription>
						</DialogHeader>
						<div class="grid gap-4 py-4">
							<div class="grid grid-cols-4 items-center gap-4">
								<Label class="text-right">名前</Label>
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
							<Button onClick={handleSave}>保存する</Button>
						</DialogFooter>
					</DialogContent>
				</Dialog>

				<Show when={selectedPresetId()}>
					<Button
						class="hover:border-red-200 hover:bg-red-50"
						onClick={() => confirmDelete(Number(selectedPresetId()))}
						size="icon"
						title="プリセット削除"
						variant="outline"
					>
						<span class="i-lucide-trash-2 h-4 w-4 text-red-500" />
					</Button>
				</Show>
			</div>
		</div>
	);
}
