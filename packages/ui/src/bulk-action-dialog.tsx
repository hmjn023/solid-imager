import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { createResource, createSignal, For, Show } from "solid-js";
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
import { toast } from "./toast";

export type BulkActionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mediaSourceId?: string;
	mediaIds: string[];
	mediaItems?: Array<{ mediaId: string; mediaSourceId: string }>;
	listSources: () => Promise<SafeMediaSource[]>;
	bulkCopyToSource: (
		sourceId: string,
		mediaIds: string[],
		targetSourceId: string,
	) => Promise<unknown>;
	bulkMoveToSource: (
		sourceId: string,
		mediaIds: string[],
		targetSourceId: string,
	) => Promise<unknown>;
	bulkMoveMedia: (
		sourceId: string,
		mediaIds: string[],
		destinationPath: string,
	) => Promise<unknown>;
	bulkDeleteMedia: (sourceId: string, mediaIds: string[]) => Promise<unknown>;
	onSuccess: (partial: boolean) => void;
};

type ActionType = "copy-source" | "move-source" | "move-folder" | "delete";

function isActionType(value: string): value is ActionType {
	return (
		value === "copy-source" ||
		value === "move-source" ||
		value === "move-folder" ||
		value === "delete"
	);
}

export function BulkActionDialog(props: BulkActionDialogProps) {
	const [action, setAction] = createSignal<ActionType>("copy-source");
	const [targetSourceId, setTargetSourceId] = createSignal("");
	const [destinationPath, setDestinationPath] = createSignal("");
	const [isSubmitting, setIsSubmitting] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal("");

	const [sources] = createResource(
		() => (props.open ? true : null),
		props.listSources,
		{ initialValue: [] },
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
	const groupedMediaIds = () => {
		const groups = new Map<string, string[]>();
		for (const item of selectedItems()) {
			const mediaIds = groups.get(item.mediaSourceId) ?? [];
			mediaIds.push(item.mediaId);
			groups.set(item.mediaSourceId, mediaIds);
		}
		return groups;
	};
	const usableSources = () =>
		(sources() ?? []).filter(
			(s): s is SafeMediaSource & { id: string } =>
				!!s.id && !selectedSourceIds().has(s.id),
		);

	const handleConfirm = async () => {
		setIsSubmitting(true);
		setErrorMsg("");
		try {
			const groups = groupedMediaIds();
			if (groups.size === 0) throw new Error("No media items are selected.");
			const currentAction = action();
			const failures: Array<{ mediaCount: number; message: string }> = [];
			let succeededMediaCount = 0;
			if (
				(currentAction === "copy-source" || currentAction === "move-source") &&
				!targetSourceId()
			) {
				throw new Error("Target source is required.");
			}
			if (currentAction === "move-folder" && !destinationPath().trim()) {
				throw new Error("Destination path is required.");
			}

			for (const [sourceId, mediaIds] of groups) {
				try {
					switch (currentAction) {
						case "copy-source":
							await props.bulkCopyToSource(
								sourceId,
								mediaIds,
								targetSourceId(),
							);
							break;
						case "move-source":
							await props.bulkMoveToSource(
								sourceId,
								mediaIds,
								targetSourceId(),
							);
							break;
						case "move-folder":
							await props.bulkMoveMedia(sourceId, mediaIds, destinationPath());
							break;
						case "delete":
							await props.bulkDeleteMedia(sourceId, mediaIds);
							break;
					}
					succeededMediaCount += mediaIds.length;
				} catch (error) {
					failures.push({
						mediaCount: mediaIds.length,
						message:
							error instanceof Error ? error.message : "An error occurred.",
					});
				}
			}

			if (failures.length > 0) {
				const failedMediaCount = failures.reduce(
					(total, failure) => total + failure.mediaCount,
					0,
				);
				if (succeededMediaCount > 0) {
					toast.error(
						`一部の操作に失敗しました（成功 ${succeededMediaCount} 件、失敗 ${failedMediaCount} 件）。`,
					);
					props.onSuccess(true);
					props.onOpenChange(false);
					return;
				}
				throw new Error(failures[0]?.message ?? "An error occurred.");
			}

			props.onSuccess(false);
			props.onOpenChange(false);
		} catch (error) {
			setErrorMsg(
				error instanceof Error ? error.message : "An error occurred.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<DialogContent class="workspace-theme sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>一括操作を実行</DialogTitle>
					<DialogDescription>
						選択された {selectedItems().length}{" "}
						件のメディアに対して一括操作を実行します。
					</DialogDescription>
				</DialogHeader>

				<div class="grid gap-4 py-4">
					<div class="flex flex-col gap-2">
						<label class="font-medium text-sm" for="bulk-action-type">
							操作を選択
						</label>
						<select
							id="bulk-action-type"
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
							value={action()}
							onChange={(event) => {
								const value = event.currentTarget.value;
								if (isActionType(value)) setAction(value);
							}}
						>
							<option value="copy-source">コピー (別ソースへ)</option>
							<option value="move-source">移動 (別ソースへ)</option>
							<option value="move-folder">フォルダ移動 (同一ソース内)</option>
							<option value="delete">一括削除</option>
						</select>
					</div>

					<Show when={action() === "copy-source" || action() === "move-source"}>
						<div class="flex flex-col gap-2">
							<label class="font-medium text-sm" for="target-source-id">
								コピー/移動先のソース
							</label>
							<select
								id="target-source-id"
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
								value={targetSourceId()}
								onChange={(event) =>
									setTargetSourceId(event.currentTarget.value)
								}
							>
								<option value="">選択してください...</option>
								<For each={usableSources()}>
									{(source) => <option value={source.id}>{source.name}</option>}
								</For>
							</select>
						</div>
					</Show>

					<Show when={action() === "move-folder"}>
						<div class="flex flex-col gap-2">
							<label class="font-medium text-sm" for="destination-path">
								移動先フォルダパス
							</label>
							<Input
								id="destination-path"
								placeholder="e.g. subfolder/new-dir"
								value={destinationPath()}
								onInput={(event) =>
									setDestinationPath(event.currentTarget.value)
								}
							/>
						</div>
					</Show>

					<Show when={action() === "delete"}>
						<div class="rounded-md bg-destructive/10 p-3 text-destructive text-sm">
							警告: この操作は元に戻せません。実ファイルも削除されます。
						</div>
					</Show>

					<Show when={errorMsg()}>
						<div class="font-medium text-red-500 text-sm">{errorMsg()}</div>
					</Show>
				</div>

				<DialogFooter>
					<Button
						disabled={isSubmitting()}
						onClick={() => props.onOpenChange(false)}
						variant="outline"
					>
						キャンセル
					</Button>
					<Button
						disabled={
							isSubmitting() ||
							(sources.loading &&
								(action() === "copy-source" || action() === "move-source"))
						}
						onClick={handleConfirm}
						variant={action() === "delete" ? "destructive" : "default"}
					>
						{isSubmitting() ? "処理中..." : "確定"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
