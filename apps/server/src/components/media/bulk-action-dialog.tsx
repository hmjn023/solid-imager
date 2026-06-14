import type { SafeMediaSource } from "@solid-imager/core/domain/sources/schemas";
import { Button } from "@solid-imager/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import { Input } from "@solid-imager/ui/input";
import { createResource, createSignal, For, Show } from "solid-js";
import {
	bulkCopyToSource,
	bulkDeleteMedia,
	bulkMoveMedia,
	bulkMoveToSource,
} from "~/infrastructure/api-clients/media-api";
import { fetchMediaSources } from "~/infrastructure/api-clients/sources-api";

type BulkActionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mediaSourceId: string;
	mediaIds: string[];
	onSuccess: () => void;
};

type ActionType = "copy-source" | "move-source" | "move-folder" | "delete";

export function BulkActionDialog(props: BulkActionDialogProps) {
	const [action, setAction] = createSignal<ActionType>("copy-source");
	const [targetSourceId, setTargetSourceId] = createSignal("");
	const [destinationPath, setDestinationPath] = createSignal("");
	const [isSubmitting, setIsSubmitting] = createSignal(false);
	const [errorMsg, setErrorMsg] = createSignal("");

	const [sources] = createResource<SafeMediaSource[], boolean>(
		() => props.open,
		async (isOpen) => {
			if (!isOpen) return [];
			return await fetchMediaSources();
		},
		{ initialValue: [] },
	);

	const usableSources = () =>
		(sources() ?? []).filter(
			(s): s is SafeMediaSource & { id: string } =>
				!!s.id && s.id !== props.mediaSourceId,
		);

	const handleConfirm = async () => {
		setIsSubmitting(true);
		setErrorMsg("");
		try {
			const currentAction = action();
			if (currentAction === "copy-source") {
				if (!targetSourceId()) {
					throw new Error("Target source is required.");
				}
				await bulkCopyToSource(
					props.mediaSourceId,
					props.mediaIds,
					targetSourceId(),
				);
			} else if (currentAction === "move-source") {
				if (!targetSourceId()) {
					throw new Error("Target source is required.");
				}
				await bulkMoveToSource(
					props.mediaSourceId,
					props.mediaIds,
					targetSourceId(),
				);
			} else if (currentAction === "move-folder") {
				if (!destinationPath().trim()) {
					throw new Error("Destination path is required.");
				}
				await bulkMoveMedia(
					props.mediaSourceId,
					props.mediaIds,
					destinationPath(),
				);
			} else if (currentAction === "delete") {
				await bulkDeleteMedia(props.mediaSourceId, props.mediaIds);
			}
			props.onSuccess();
			props.onOpenChange(false);
		} catch (e: any) {
			setErrorMsg(e.message || "An error occurred.");
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={props.open} onOpenChange={props.onOpenChange}>
			<DialogContent class="sm:max-w-[425px]">
				<DialogHeader>
					<DialogTitle>一括操作を実行</DialogTitle>
					<DialogDescription>
						選択された {props.mediaIds.length}{" "}
						件のメディアに対して一括操作を実行します。
					</DialogDescription>
				</DialogHeader>

				<div class="grid gap-4 py-4">
					<div class="flex flex-col gap-2">
						<label class="text-sm font-medium" for="bulk-action-type">
							操作を選択
						</label>
						<select
							id="bulk-action-type"
							class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
							value={action()}
							onChange={(e) => setAction(e.target.value as ActionType)}
						>
							<option value="copy-source">コピー (別ソースへ)</option>
							<option value="move-source">移動 (別ソースへ)</option>
							<option value="move-folder">フォルダ移動 (同一ソース内)</option>
							<option value="delete">一括削除</option>
						</select>
					</div>

					<Show when={action() === "copy-source" || action() === "move-source"}>
						<div class="flex flex-col gap-2">
							<label class="text-sm font-medium" for="target-source-id">
								コピー/移動先のソース
							</label>
							<select
								id="target-source-id"
								class="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
								value={targetSourceId()}
								onChange={(e) => setTargetSourceId(e.target.value)}
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
							<label class="text-sm font-medium" for="destination-path">
								移動先フォルダパス
							</label>
							<Input
								id="destination-path"
								placeholder="e.g. subfolder/new-dir"
								value={destinationPath()}
								onInput={(e) => setDestinationPath(e.currentTarget.value)}
							/>
						</div>
					</Show>

					<Show when={action() === "delete"}>
						<div class="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
							警告: この操作は元に戻せません。実ファイルも削除されます。
						</div>
					</Show>

					<Show when={errorMsg()}>
						<div class="text-sm text-red-500 font-medium">{errorMsg()}</div>
					</Show>
				</div>

				<DialogFooter>
					<Button
						variant="outline"
						onClick={() => props.onOpenChange(false)}
						disabled={isSubmitting()}
					>
						キャンセル
					</Button>
					<Button
						onClick={handleConfirm}
						disabled={
							isSubmitting() ||
							(sources.loading &&
								(action() === "copy-source" || action() === "move-source"))
						}
						variant={action() === "delete" ? "destructive" : "default"}
					>
						{isSubmitting() ? "処理中..." : "確定"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
