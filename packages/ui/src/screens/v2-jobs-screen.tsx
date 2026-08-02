import Ban from "lucide-solid/icons/ban";
import CircleAlert from "lucide-solid/icons/circle-alert";
import CircleCheck from "lucide-solid/icons/circle-check";
import Clock3 from "lucide-solid/icons/clock-3";
import RefreshCw from "lucide-solid/icons/refresh-cw";
import RotateCcw from "lucide-solid/icons/rotate-ccw";
import { createSignal, For } from "solid-js";
import { Badge } from "../badge";
import { Button } from "../button";
import { Card, CardContent } from "../card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../tabs";
import {
	V2_CATEGORY_TABS_CLASS,
	V2CategoryLabel,
	V2ManagementHeader,
} from "../v2/management-layout";

const JOB_FILTERS = [
	{ description: "すべての処理", icon: Clock3, label: "All", value: "all" },
	{
		description: "実行中と待機中",
		icon: RefreshCw,
		label: "Active",
		value: "active",
	},
	{
		description: "確認が必要な処理",
		icon: CircleAlert,
		label: "Failed",
		value: "failed",
	},
	{
		description: "完了した処理",
		icon: CircleCheck,
		label: "Completed",
		value: "completed",
	},
] as const;

function JobsUnavailableState(props: { filterLabel: string }) {
	return (
		<Card class="rounded-md border-[var(--v2-border)] border-dashed bg-[var(--v2-surface)] shadow-none">
			<CardContent class="flex min-h-64 flex-col items-center justify-center px-5 py-10 text-center">
				<span class="flex size-11 items-center justify-center rounded-full bg-[var(--v2-surface-muted)] text-[var(--v2-text-muted)]">
					<Clock3 aria-hidden="true" size={20} />
				</span>
				<h2 class="mt-4 font-semibold text-base text-[var(--v2-text)]">
					{props.filterLabel} jobsはまだ表示できません
				</h2>
				<p class="mt-2 max-w-xl text-sm leading-6 text-[var(--v2-text-secondary)]">
					現在のバックエンドはジョブイベントのみを配信しており、一覧・詳細・履歴を取得するAPIは未実装です。
					実データを取得できるようになるまで、この画面では状態を推測して表示しません。
				</p>
				<Badge
					class="mt-4 border-[var(--v2-border-strong)] bg-[var(--v2-surface-muted)] text-[var(--v2-text-secondary)]"
					variant="outline"
				>
					Backend support required
				</Badge>
			</CardContent>
		</Card>
	);
}

function JobsInspectorPlaceholder() {
	return (
		<aside
			aria-label="Job details"
			class="hidden min-h-0 overflow-y-auto overscroll-contain border-[var(--v2-border)] border-l bg-[var(--v2-surface-subtle)] p-5 [scrollbar-gutter:stable] xl:block"
		>
			<div class="flex items-start justify-between gap-3">
				<div>
					<p class="text-xs text-[var(--v2-text-muted)]">Inspector</p>
					<h2 class="mt-1 font-semibold text-base text-[var(--v2-text)]">
						Job details
					</h2>
				</div>
				<Badge
					class="border-[var(--v2-border-strong)] text-[var(--v2-text-muted)]"
					variant="outline"
				>
					Unavailable
				</Badge>
			</div>

			<p class="mt-3 text-sm leading-6 text-[var(--v2-text-secondary)]">
				一覧APIの実装後、選択したジョブの進捗・対象・失敗理由をここに表示します。
			</p>

			<dl class="mt-5 space-y-3 border-[var(--v2-border)] border-y py-4 text-xs">
				<div class="flex justify-between gap-3">
					<dt class="text-[var(--v2-text-muted)]">Status</dt>
					<dd class="text-[var(--v2-text-secondary)]">—</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt class="text-[var(--v2-text-muted)]">Source</dt>
					<dd class="text-[var(--v2-text-secondary)]">—</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt class="text-[var(--v2-text-muted)]">Started</dt>
					<dd class="text-[var(--v2-text-secondary)]">—</dd>
				</div>
				<div class="flex justify-between gap-3">
					<dt class="text-[var(--v2-text-muted)]">Job ID</dt>
					<dd class="text-[var(--v2-text-secondary)]">—</dd>
				</div>
			</dl>

			<div class="mt-5 rounded-md border border-[var(--v2-border)] bg-[var(--v2-surface-muted)] p-3">
				<div class="flex items-start gap-2 text-sm text-[var(--v2-text-secondary)]">
					<CircleAlert aria-hidden="true" class="mt-0.5 shrink-0" size={16} />
					<p>再実行とキャンセル用APIも未実装のため、操作は無効です。</p>
				</div>
			</div>

			<div class="mt-4 space-y-2">
				<Button class="w-full" disabled variant="outline">
					<RotateCcw aria-hidden="true" size={15} />
					Retry job
				</Button>
				<Button class="w-full" disabled variant="outline">
					<Ban aria-hidden="true" size={15} />
					Cancel job
				</Button>
			</div>
		</aside>
	);
}

export function V2JobsScreen() {
	const [activeFilter, setActiveFilter] = createSignal("all");

	return (
		<section class="flex h-full min-h-0 min-w-0 flex-col bg-[var(--v2-canvas)]">
			<V2ManagementHeader
				actions={
					<div class="flex items-center gap-2">
						<Badge
							class="border-[var(--v2-warning)] bg-[var(--v2-warning-surface)] text-[var(--v2-warning)]"
							variant="outline"
						>
							History API unavailable
						</Badge>
						<Button disabled size="sm" variant="outline">
							<RefreshCw aria-hidden="true" size={14} />
							Refresh
						</Button>
					</div>
				}
				description="バックグラウンド処理の進捗、失敗、履歴を確認します。"
				title="Jobs"
			/>

			<div class="grid min-h-0 flex-1 xl:grid-cols-[minmax(0,1fr)_22rem]">
				<div class="min-h-0 overflow-y-auto overscroll-contain px-3 py-4 sm:px-4 lg:px-6 lg:py-5 xl:px-8 [scrollbar-gutter:stable]">
					<Tabs onChange={setActiveFilter} value={activeFilter()}>
						<div class="grid gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] xl:gap-8">
							<TabsList
								aria-label="Job status filter"
								class="flex h-auto max-w-full justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 lg:sticky lg:top-0 lg:flex-col lg:self-start lg:overflow-visible"
							>
								<For each={JOB_FILTERS}>
									{(filter) => {
										const Icon = filter.icon;
										return (
											<TabsTrigger
												class={V2_CATEGORY_TABS_CLASS}
												type="button"
												value={filter.value}
											>
												<V2CategoryLabel
													description={filter.description}
													icon={<Icon aria-hidden="true" size={16} />}
													label={filter.label}
												/>
											</TabsTrigger>
										);
									}}
								</For>
							</TabsList>
							<div class="min-w-0">
								<For each={JOB_FILTERS}>
									{(filter) => (
										<TabsContent class="mt-0" value={filter.value}>
											<JobsUnavailableState filterLabel={filter.label} />
										</TabsContent>
									)}
								</For>
							</div>
						</div>
					</Tabs>
				</div>

				<JobsInspectorPlaceholder />
			</div>
		</section>
	);
}
