import { Badge } from "@solid-imager/ui/badge";
import { Button } from "@solid-imager/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@solid-imager/ui/card";
import { toast } from "@solid-imager/ui/toast";
import { createQuery, useQueryClient } from "@tanstack/solid-query";
import { createFileRoute } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { logger } from "~/infrastructure/logger";

export const Route = createFileRoute("/sync/")({
	component: SyncManagement,
});

interface SourceSyncStatus {
	sourceId: string;
	sourceName: string;
	totalMedia: number;
	synced: number;
	pending: number;
	failed: number;
	conflicts: number;
}

/**
 * Sync Management Page
 * Manages server-to-server media synchronization
 */
function SyncManagement() {
	const queryClient = useQueryClient();
	const [selectedSourceId, setSelectedSourceId] = createSignal<string | null>(
		null,
	);
	const [isSyncing, setIsSyncing] = createSignal(false);

	// Fetch media sources
	const sources = createQuery(() => ({
		queryKey: ["mediaSources"],
		queryFn: () => orpc.sources.list(),
	}));

	// Fetch sync status for selected source
	const syncStatus = createQuery(() => ({
		queryKey: ["syncStatus", selectedSourceId()],
		queryFn: () => {
			const sourceId = selectedSourceId();
			if (!sourceId) return null;
			return orpc.sync.getSourceSyncStatus({ sourceId });
		},
		enabled: !!selectedSourceId(),
	}));

	// Execute sync
	const handleSync = async () => {
		const sourceId = selectedSourceId();
		if (!sourceId || isSyncing()) return;

		setIsSyncing(true);

		try {
			const result = await orpc.sync.sync({
				localSourceId: sourceId,
				remoteSourceId: sourceId,
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
				queryKey: ["syncStatus", sourceId],
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
		const sourceId = selectedSourceId();
		if (!sourceId) return;

		try {
			const result = await orpc.sync.sync({
				localSourceId: sourceId,
				remoteSourceId: sourceId,
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
	const _handleResolveConflict = async (
		localMediaId: string,
		remoteMediaId: string,
		resolution: "newer_wins" | "local_wins" | "remote_wins",
	) => {
		try {
			const result = await orpc.sync.resolveConflict({
				localMediaId,
				remoteMediaId,
				resolution,
			});

			if (result.success) {
				toast.success("コンフリクトが解決されました");
				// Refresh sync status
				await queryClient.invalidateQueries({
					queryKey: ["syncStatus", selectedSourceId()],
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
				{/* Source Selection */}
				<Card>
					<CardHeader>
						<CardTitle>ソース選択</CardTitle>
						<CardDescription>
							同期するメディアソースを選択してください
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div class="space-y-2">
							<For each={sources.data}>
								{(source) => (
									<Button
										variant={
											selectedSourceId() === source.id ? "default" : "outline"
										}
										class="w-full justify-start"
										onClick={() => setSelectedSourceId(source.id ?? null)}
									>
										<span class="mr-2">
											{source.type === "remote" ? "🌐" : "📁"}
										</span>
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
							when={selectedSourceId()}
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

										<Show when={status().conflicts > 0}>
											<div class="rounded-lg border border-yellow-500 bg-yellow-50 p-3">
												<div class="flex items-center justify-between">
													<div>
														<div class="font-semibold text-yellow-800">
															{status().conflicts}件のコンフリクト
														</div>
														<p class="text-xs text-yellow-700">
															手動解決が必要です
														</p>
													</div>
													<Button variant="outline" size="sm">
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
								disabled={!selectedSourceId()}
								variant="outline"
							>
								ドライラン
							</Button>
							<Button
								onClick={handleSync}
								disabled={!selectedSourceId() || isSyncing()}
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
		</div>
	);
}
