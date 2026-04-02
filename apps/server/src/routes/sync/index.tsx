import type { ConflictResolution } from "@solid-imager/core/domain/media/sync-schemas";
import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@solid-imager/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@solid-imager/ui/select";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { logger } from "~/infrastructure/logger";

export const Route = createFileRoute("/sync/")({
	component: SyncManagement,
});

/**
 * Sync Management Page
 * Manages server-to-server media synchronization
 */
function SyncManagement() {
	const queryClient = useQueryClient();
	const [selectedLocalSourceId, setSelectedLocalSourceId] = createSignal<
		string | null
	>(null);
	const [selectedRemoteSourceId, setSelectedRemoteSourceId] = createSignal<
		string | null
	>(null);
	const [isSyncing, setIsSyncing] = createSignal(false);
	const [isConflictDialogOpen, setIsConflictDialogOpen] = createSignal(false);
	const [selectedConflictId, setSelectedConflictId] = createSignal<
		string | null
	>(null);
	const [selectedResolution, setSelectedResolution] =
		createSignal<ConflictResolution>("newer_wins");

	// Fetch media sources
	const sources = createQuery(() => ({
		queryKey: ["mediaSources"],
		queryFn: () => orpc.sources.list(),
	}));

	// Fetch sync status for selected local source
	const syncStatus = createQuery(() => ({
		queryKey: ["syncStatus", selectedLocalSourceId()],
		queryFn: () => {
			const sourceId = selectedLocalSourceId();
			if (!sourceId) return null;
			return orpc.sync.getSourceSyncStatus({
				sourceId,
				remoteSourceId: selectedRemoteSourceId() ?? "",
			});
		},
		enabled: !!selectedLocalSourceId() && !!selectedRemoteSourceId(),
	}));

	const conflictOptions = createMemo(
		() =>
			syncStatus.data?.conflicts.map((conflict) => ({
				value: conflict.id,
				label: `${conflict.localFilePath} <> ${conflict.remoteFilePath}`,
			})) ?? [],
	);

	const selectedConflict = createMemo(
		() =>
			syncStatus.data?.conflicts.find(
				(conflict) => conflict.id === selectedConflictId(),
			) ?? null,
	);

	createEffect(() => {
		const firstConflict = syncStatus.data?.conflicts[0];
		if (!firstConflict) {
			setSelectedConflictId(null);
			setIsConflictDialogOpen(false);
			return;
		}
		if (!selectedConflict()) {
			setSelectedConflictId(firstConflict.id);
		}
	});

	// Execute sync
	const handleSync = async () => {
		const localSourceId = selectedLocalSourceId();
		const remoteSourceId = selectedRemoteSourceId();
		if (!localSourceId || !remoteSourceId || isSyncing()) return;

		setIsSyncing(true);

		try {
			const result = await orpc.sync.sync({
				localSourceId,
				remoteSourceId,
				direction: "bidirectional",
				conflictResolution: "newer_wins",
				dryRun: false,
			});

			if (result.success) {
				toast.success(
					`${result.stats.pulled}件のメディアを取得、${result.stats.pushed}件のメディアを送信しました`,
				);
			} else {
				toast.error(`${result.stats.errors}件のエラーが発生しました`);
			}

			// Refresh sync status
			await queryClient.invalidateQueries({
				queryKey: ["syncStatus", localSourceId],
			});
		} catch (error) {
			logger.error({ error }, "Sync failed");
			toast.error("同期処理中にエラーが発生しました");
		} finally {
			setIsSyncing(false);
		}
	};

	// Dry run sync
	const handleDryRun = async () => {
		const localSourceId = selectedLocalSourceId();
		const remoteSourceId = selectedRemoteSourceId();
		if (!localSourceId || !remoteSourceId) return;

		try {
			const result = await orpc.sync.sync({
				localSourceId,
				remoteSourceId,
				direction: "bidirectional",
				conflictResolution: "newer_wins",
				dryRun: true,
			});

			toast.info(
				`プル: ${result.stats.pulled}、プッシュ: ${result.stats.pushed}、コンフリクト: ${result.stats.conflicts}`,
			);
		} catch (error) {
			logger.error({ error }, "Dry run failed");
			toast.error("ドライラン中にエラーが発生しました");
		}
	};

	// Resolve conflict
	const handleResolveConflict = async () => {
		const remoteSourceId = selectedRemoteSourceId();
		const conflict = selectedConflict();
		if (!remoteSourceId || !conflict) return;

		try {
			const result = await orpc.sync.resolveConflict({
				localMediaId: conflict.localMediaId,
				remoteMediaId: conflict.remoteMediaId,
				resolution: selectedResolution(),
				remoteSourceId,
			});

			if (result.success) {
				toast.success("コンフリクトが解決されました");
				setIsConflictDialogOpen(false);
				// Refresh sync status
				await queryClient.invalidateQueries({
					queryKey: ["syncStatus", selectedLocalSourceId()],
				});
			}
		} catch (error) {
			logger.error({ error }, "Conflict resolution failed");
			toast.error("コンフリクト解決中にエラーが発生しました");
		}
	};

	return (
		<div class="container mx-auto p-6">
			<div class="mb-6">
				<h1 class="text-3xl font-bold">同期管理</h1>
				<p class="text-muted-foreground">
					サーバー間でのメディア同期を管理します
				</p>
			</div>

			<div class="grid gap-6 md:grid-cols-2">
				{/* Local Source Selection */}
				<Card>
					<CardHeader>
						<CardTitle>ローカルソース選択</CardTitle>
						<CardDescription>
							同期元のローカルソースを選択してください
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-2">
							<For each={sources.data?.filter((s) => s.type === "local")}>
								{(source) => (
									<Button
										variant={
											selectedLocalSourceId() === source.id
												? "default"
												: "outline"
										}
										class="w-full justify-start"
										onClick={() => setSelectedLocalSourceId(source.id ?? null)}
									>
										<span class="mr-2">📁</span>
										{source.name}
										<Badge variant="secondary" class="ml-auto">
											{source.type}
										</Badge>
									</Button>
								)}
							</For>
						</div>
					</CardContent>
				</Card>

				{/* Remote Source Selection */}
				<Card>
					<CardHeader>
						<CardTitle>リモートソース選択</CardTitle>
						<CardDescription>
							同期先のリモートソースを選択してください
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-2">
							<For each={sources.data?.filter((s) => s.type === "remote")}>
								{(source) => (
									<Button
										variant={
											selectedRemoteSourceId() === source.id
												? "default"
												: "outline"
										}
										class="w-full justify-start"
										onClick={() => setSelectedRemoteSourceId(source.id ?? null)}
									>
										<span class="mr-2">🌐</span>
										{source.name}
										<Badge variant="secondary" class="ml-auto">
											{source.type}
										</Badge>
									</Button>
								)}
							</For>
						</div>
					</CardContent>
				</Card>

				{/* Sync Status */}
				<Card>
					<CardHeader>
						<CardTitle>同期ステータス</CardTitle>
						<CardDescription>
							選択したソースの同期状態を表示します
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Show
							when={selectedLocalSourceId()}
							fallback={
								<p class="text-muted-foreground">ソースを選択してください</p>
							}
						>
							<Show
								when={syncStatus.data}
								fallback={<p class="text-muted-foreground">読み込み中...</p>}
							>
								{(status) => (
									<div class="space-y-4">
										<div class="grid grid-cols-2 gap-4">
											<div class="rounded-lg border p-3">
												<div class="text-2xl font-bold">
													{status().totalMedia}
												</div>
												<p class="text-xs text-muted-foreground">
													総メディア数
												</p>
											</div>
											<div class="rounded-lg border p-3">
												<div class="text-2xl font-bold text-green-600">
													{status().synced}
												</div>
												<p class="text-xs text-muted-foreground">同期済み</p>
											</div>
											<div class="rounded-lg border p-3">
												<div class="text-2xl font-bold text-yellow-600">
													{status().pending}
												</div>
												<p class="text-xs text-muted-foreground">保留中</p>
											</div>
											<div class="rounded-lg border p-3">
												<div class="text-2xl font-bold text-red-600">
													{status().failed}
												</div>
												<p class="text-xs text-muted-foreground">失敗</p>
											</div>
										</div>

										<Show when={status().conflicts.length > 0}>
											<div class="rounded-lg border border-yellow-500 bg-yellow-50 p-3">
												<div class="flex items-center justify-between">
													<div>
														<div class="font-semibold text-yellow-800">
															{status().conflicts.length}件のコンフリクト
														</div>
														<p class="text-xs text-yellow-700">
															手動解決が必要です
														</p>
													</div>
													<Button
														variant="outline"
														size="sm"
														onClick={() => setIsConflictDialogOpen(true)}
													>
														解決する
													</Button>
												</div>
											</div>
										</Show>
									</div>
								)}
							</Show>
						</Show>
					</CardContent>
				</Card>

				{/* Sync Actions */}
				<Card class="md:col-span-2">
					<CardHeader>
						<CardTitle>同期アクション</CardTitle>
						<CardDescription>同期を実行またはプレビューします</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="flex gap-4">
							<Button
								onClick={handleDryRun}
								disabled={!selectedLocalSourceId() || !selectedRemoteSourceId()}
								variant="outline"
							>
								ドライラン
							</Button>
							<Button
								onClick={handleSync}
								disabled={
									!selectedLocalSourceId() ||
									!selectedRemoteSourceId() ||
									isSyncing()
								}
							>
								{isSyncing() ? (
									<>
										<span class="mr-2 animate-spin">⏳</span>
										同期中...
									</>
								) : (
									"同期実行"
								)}
							</Button>
						</div>
					</CardContent>
				</Card>
			</div>

			<Dialog
				onOpenChange={setIsConflictDialogOpen}
				open={isConflictDialogOpen()}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>コンフリクト解決</DialogTitle>
						<DialogDescription>
							実際のコンフリクト一覧から対象を選択して解決します。
						</DialogDescription>
					</DialogHeader>

					<div class="space-y-4 py-2">
						<Select
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{(itemProps.item.rawValue as { label: string }).label}
								</SelectItem>
							)}
							onChange={(value) => setSelectedConflictId(value?.value ?? null)}
							options={conflictOptions()}
							optionTextValue="label"
							optionValue="value"
							value={
								conflictOptions().find(
									(option) => option.value === selectedConflictId(),
								) ?? null
							}
						>
							<SelectTrigger>
								<SelectValue<{ label: string; value: string }>>
									{(state) =>
										state.selectedOption()?.label ?? "コンフリクトを選択"
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>

						<Show when={selectedConflict()}>
							{(conflict) => (
								<div class="rounded-lg border bg-muted/20 p-3 text-sm">
									<p>local: {conflict().localFilePath}</p>
									<p>remote: {conflict().remoteFilePath}</p>
									<p>type: {conflict().conflictType}</p>
								</div>
							)}
						</Show>

						<Select
							itemComponent={(itemProps) => (
								<SelectItem item={itemProps.item}>
									{(itemProps.item.rawValue as { label: string }).label}
								</SelectItem>
							)}
							onChange={(value) =>
								setSelectedResolution(
									(value?.value as ConflictResolution | undefined) ??
										"newer_wins",
								)
							}
							options={[
								{ value: "newer_wins", label: "newer_wins" },
								{ value: "local_wins", label: "local_wins" },
								{ value: "remote_wins", label: "remote_wins" },
							]}
							optionTextValue="label"
							optionValue="value"
							value={{
								value: selectedResolution(),
								label: selectedResolution(),
							}}
						>
							<SelectTrigger>
								<SelectValue<{ label: string; value: string }>>
									{(state) =>
										state.selectedOption()?.label ?? "解決ポリシーを選択"
									}
								</SelectValue>
							</SelectTrigger>
							<SelectContent />
						</Select>
					</div>

					<DialogFooter>
						<Button
							onClick={() => setIsConflictDialogOpen(false)}
							variant="outline"
						>
							キャンセル
						</Button>
						<Button
							disabled={!selectedConflict()}
							onClick={handleResolveConflict}
						>
							解決する
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
