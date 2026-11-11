import type { SafeMediaSource } from "@solid-imager/core/sources";
import {
	createEffect,
	createResource,
	createSignal,
	For,
	Show,
} from "solid-js";
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
import {
	createBulkActionCommand,
	executeBulkActionCommand,
	type BulkActionCommand,
	type BulkActionItem,
	type BulkCommandOperations,
} from "./bulk-action-command";

export type BulkActionDialogProps = {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mediaSourceId?: string;
	mediaIds: string[];
	mediaItems?: Array<{ mediaId: string; mediaSourceId: string }>;
	listSources: () => Promise<SafeMediaSource[]>;
	onSuccess: (partial: boolean, succeededMediaIds: string[]) => void;
} & BulkCommandOperations;

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
	const [retryCommand, setRetryCommand] =
		createSignal<BulkActionCommand | null>(null);
	const [uncertainItems, setUncertainItems] = createSignal<BulkActionItem[]>(
		[],
	);
	createEffect(() => {
		if (!props.open && !isSubmitting()) {
			setRetryCommand(null);
			setUncertainItems([]);
			setErrorMsg("");
		}
	});

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
	const usableSources = () =>
		(sources() ?? []).filter(
			(s): s is SafeMediaSource & { id: string } =>
				!!s.id && !selectedSourceIds().has(s.id),
		);

	const handleConfirm = async () => {
		if (isSubmitting()) return;
		setIsSubmitting(true);
		setErrorMsg("");
		try {
			const command =
				retryCommand() ??
				createBulkActionCommand({
					action: action(),
					items: selectedItems(),
					targetSourceId: targetSourceId(),
					destinationPath: destinationPath(),
				});
			const outcome = await executeBulkActionCommand(command, props);
			const unknown = [...uncertainItems(), ...outcome.uncertainItems];
			setUncertainItems(unknown);
			const partial = outcome.retryItems.length > 0 || unknown.length > 0;
			props.onSuccess(partial, outcome.succeededMediaIds);
			if (partial) {
				setRetryCommand({ ...command, items: outcome.retryItems });
				setErrorMsg(
					`成功 ${outcome.succeededMediaIds.length} 件、再試行可能 ${outcome.retryItems.length} 件、結果不明 ${unknown.length} 件。` +
						(unknown.length
							? "結果不明の項目は再送せず、ダイアログを閉じて一覧と保存先を確認してください。"
							: "失敗・未処理の項目だけを同じ宛先へ再試行できます。"),
				);
			} else {
				setRetryCommand(null);
				props.onOpenChange(false);
			}
		} catch (error) {
			setErrorMsg(
				error instanceof Error ? error.message : "An error occurred.",
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog
			open={props.open}
			onOpenChange={(open) => {
				if (!isSubmitting()) props.onOpenChange(open);
			}}
		>
			<DialogContent class="workspace-theme sm:max-w-dialog-xs">
				<DialogHeader>
					<DialogTitle>一括操作を実行</DialogTitle>
					<DialogDescription>
						選択された {selectedItems().length}{" "}
						件のメディアに対して一括操作を実行します。
					</DialogDescription>
				</DialogHeader>

				<div class="grid gap-4 py-4">
					<label class="flex flex-col gap-2 font-medium text-sm">
						操作を選択
						<select
							id="bulk-action-type"
							disabled={isSubmitting() || retryCommand() !== null}
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
					</label>

					<Show when={action() === "copy-source" || action() === "move-source"}>
						<label class="flex flex-col gap-2 font-medium text-sm">
							コピー/移動先のソース
							<select
								id="target-source-id"
								disabled={isSubmitting() || retryCommand() !== null}
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
						</label>
					</Show>

					<Show when={action() === "move-folder"}>
						<div class="flex flex-col gap-2 font-medium text-sm">
							<span id="destination-path-label">移動先フォルダパス</span>
							<Input
								aria-labelledby="destination-path-label"
								id="destination-path"
								disabled={isSubmitting() || retryCommand() !== null}
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
						<div class="font-medium text-destructive text-sm">{errorMsg()}</div>
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
							(retryCommand() !== null && retryCommand()?.items.length === 0) ||
							(sources.loading &&
								(action() === "copy-source" || action() === "move-source"))
						}
						onClick={() => {
							void handleConfirm();
						}}
						variant={action() === "delete" ? "destructive" : "default"}
					>
						{isSubmitting()
							? "処理中..."
							: retryCommand()
								? "失敗・未処理だけ再試行"
								: "確定"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
