import type {
	TagDictionarySource,
	TagDictionaryStatus,
} from "@solid-imager/core/tags";
import { getLocale, t, type StaticMessageKey } from "@solid-imager/i18n";
import {
	createMutation,
	createQuery,
	useQueryClient,
} from "@tanstack/solid-query";
import { Link } from "@tanstack/solid-router";
import { createEffect, createUniqueId, For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { ErrorState } from "../../async-state";
import { Badge } from "../../badge";
import { Button } from "../../button";
import { Card } from "../../card";
import {
	type JobEventStreamFactory,
	useBatchJobEvents,
} from "../../hooks/use-batch-job-events";
import { TagDictionaryBrowser } from "../../tag-dictionary-browser";
import {
	searchQueryKeys,
	sourceMediaQueryKeys,
} from "../../query-options/search-query";
import {
	TAG_DICTIONARY_QUERY_KEY,
	tagsQueryKeys,
} from "../../query-options/tags-query";
import { Clock3, Database, Download, RefreshCw } from "../../workspace/icons";
import {
	LegacyTagMigration,
	type LegacyTagMigrationActions,
} from "./legacy-tag-migration";
import { formatDate } from "./utils";

export type TagDictionaryActions = LegacyTagMigrationActions & {
	dictionaryStatus: () => Promise<TagDictionaryStatus>;
	dictionaryRefresh: () => Promise<{ jobId: string | null }>;
	openJobEvents: JobEventStreamFactory;
};

const STATUS_QUERY_KEY = [...TAG_DICTIONARY_QUERY_KEY, "status"] as const;
const JOB_LABELS = {
	pending: "status.queued",
	in_progress: "status.inProgress",
	completed: "status.completed",
	failed: "status.failed",
	cancelled: "status.cancelled",
} satisfies Record<
	NonNullable<TagDictionaryStatus["job"]>["status"],
	StaticMessageKey
>;
const SOURCES = [
	{
		id: "tags",
		labelKey: "tagDictionary.tagsSource",
		url: "https://github.com/PYU224/tagdb-updater",
	},
	{
		id: "wiki",
		labelKey: "tagDictionary.wikiSource",
		url: "https://huggingface.co/datasets/patvessel/danbooru-wiki-2606",
	},
	{
		id: "attributes",
		labelKey: "tagDictionary.attributesSource",
		url: "https://huggingface.co/datasets/StoryAura/Danbooru-Dataset-csv",
	},
] as const satisfies readonly {
	id: TagDictionarySource;
	labelKey: StaticMessageKey;
	url: string;
}[];

export function TagDictionaryPanel(props: { actions: TagDictionaryActions }) {
	const titleId = createUniqueId();
	const searchTitleId = createUniqueId();
	const client = useQueryClient();
	const status = createQuery(() => ({
		queryKey: STATUS_QUERY_KEY,
		queryFn: () => props.actions.dictionaryStatus(),
		enabled: !isServer,
	}));
	const invalidate = () =>
		client.invalidateQueries({ queryKey: TAG_DICTIONARY_QUERY_KEY });
	const invalidateLibrary = () => {
		for (const queryKey of [
			tagsQueryKeys.all(),
			searchQueryKeys.all(),
			sourceMediaQueryKeys.all(),
			["mediaDetails"],
			["relatedMedia"],
		])
			void client.invalidateQueries({ queryKey });
	};
	const refresh = createMutation(() => ({
		mutationFn: () => props.actions.dictionaryRefresh(),
		onSuccess: invalidate,
	}));
	let lastLibraryRefresh: string | undefined;
	const refreshLibraryFor = (id: string | null) => {
		if (id && id !== lastLibraryRefresh) {
			lastLibraryRefresh = id;
			invalidateLibrary();
		}
	};
	const jobId = () => status.data?.job?.id ?? null;
	const finish = () => {
		refreshLibraryFor(jobId());
		void invalidate();
	};
	useBatchJobEvents(
		jobId,
		{
			handleJobProgress: () => void invalidate(),
			handleJobCompleted: finish,
			handleJobFailed: finish,
			handleJobCancelled: finish,
		},
		(signal) => props.actions.openJobEvents(signal),
		{
			subscribeImmediately: true,
			onConnected: invalidate,
			onEvent: (event) => {
				if (
					event.event === "job-progress" &&
					event.data.created &&
					event.data.jobId !== jobId()
				)
					void invalidate();
			},
		},
	);
	createEffect(() => {
		// The persisted job outcome also covers terminal events missed while disconnected.
		const job = status.data?.job;
		if (job && job.status !== "pending" && job.status !== "in_progress") {
			refreshLibraryFor(job.id);
		}
	});
	const active = () =>
		status.data?.job?.status === "pending" ||
		status.data?.job?.status === "in_progress";
	const snapshotFor = (source: TagDictionarySource) =>
		status.data?.snapshots.find((snapshot) => snapshot.source === source);
	const installed = () => Boolean(snapshotFor("tags"));

	return (
		<section aria-labelledby={titleId} class="space-y-4">
			<Card class="@container min-w-0 shadow-none">
				<header class="flex flex-wrap items-center justify-between gap-4 p-4">
					<div class="flex min-w-0 items-start gap-3">
						<span class="grid size-10 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground">
							<Database size={20} />
						</span>
						<div class="min-w-0 space-y-1">
							<h2 class="text-base font-semibold" id={titleId}>
								{t("tagDictionary.title")}
							</h2>
							<p class="text-sm text-muted-foreground">
								{t("tagDictionary.importDescription")}
							</p>
						</div>
					</div>
					<Button
						type="button"
						class="min-h-12 w-full @sm:min-h-9 @sm:w-auto"
						disabled={!status.data || refresh.isPending || active()}
						onClick={() => refresh.mutate()}
					>
						<Show when={installed()} fallback={<Download size={16} />}>
							<RefreshCw size={16} />
						</Show>
						{t(installed() ? "tagDictionary.refresh" : "tagDictionary.install")}
					</Button>
				</header>

				<Show when={status.isError}>
					<div class="px-4 pb-4">
						<ErrorState
							title={t("tagDictionary.statusError")}
							onRetry={() => void status.refetch()}
						/>
					</div>
				</Show>

				<div aria-live="polite" aria-atomic="true">
					<Show when={status.isPending || refresh.isPending || refresh.isError}>
						<p
							class="border-t px-4 py-3 text-sm text-muted-foreground"
							classList={{ "bg-error text-destructive": refresh.isError }}
						>
							{t(
								refresh.isError
									? "tagDictionary.refreshError"
									: refresh.isPending
										? "tagDictionary.requestingRefresh"
										: "status.loading",
							)}
						</p>
					</Show>
					<Show when={status.data?.job}>
						{(job) => (
							<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-t bg-muted px-4 py-3 text-sm">
								<div class="min-w-0 space-y-1">
									<div class="flex flex-wrap items-center gap-2">
										<Clock3 size={16} class="text-muted-foreground" />
										<span class="font-medium">
											{t("tagDictionary.refreshJob")}
										</span>
										<Badge
											variant={
												job().status === "failed" ? "destructive" : "outline"
											}
											class="rounded-full"
											classList={{
												"bg-info text-info-foreground": active(),
												"bg-success text-success-foreground":
													job().status === "completed",
											}}
										>
											{t(JOB_LABELS[job().status])}
										</Badge>
									</div>
									<p class="text-xs text-muted-foreground">
										{t("tagDictionary.jobUpdatedAt", {
											date: formatDate(job().updatedAt, { includeTime: true }),
										})}
									</p>
									<Show when={job().error}>
										<p class="wrap-anywhere text-destructive">{job().error}</p>
									</Show>
								</div>
								<Button
									as={Link}
									href={`/jobs?jobId=${encodeURIComponent(job().id)}`}
									variant="outline"
									size="sm"
									class="min-h-12 bg-card @sm:min-h-9"
								>
									{t("jobsScreen.jobDetails")}
								</Button>
							</div>
						)}
					</Show>
				</div>

				<Show when={status.data}>
					<dl class="grid divide-y border-t @3xl:grid-cols-3 @3xl:divide-x @3xl:divide-y-0">
						<For each={SOURCES}>
							{(source) => (
								<div class="min-w-0 space-y-1 px-4 pt-1 pb-4">
									<dt>
										<a
											class="inline-flex min-h-12 items-center rounded-sm text-sm font-medium decoration-border underline underline-offset-4 hover:text-primary hover:decoration-current focus-visible:outline-2 focus-visible:outline-ring @sm:min-h-9"
											href={source.url}
											target="_blank"
											rel="noreferrer"
										>
											{t(source.labelKey)}
										</a>
									</dt>
									<dd class="space-y-2 text-muted-foreground">
										<Show
											when={snapshotFor(source.id)}
											fallback={
												<Badge
													variant="outline"
													class="rounded-full text-muted-foreground"
												>
													{t("tagDictionary.notInstalled")}
												</Badge>
											}
										>
											{(snapshot) => (
												<>
													<Badge
														variant="secondary"
														class="rounded-full bg-success text-success-foreground"
													>
														{t("tagDictionary.installed")}
													</Badge>
													<p class="wrap-anywhere text-xs">
														{t("tagDictionary.snapshotStatus", {
															version:
																source.id === "tags"
																	? formatDate(snapshot().version)
																	: snapshot().version,
															count:
																snapshot().count.toLocaleString(getLocale()),
															date: formatDate(snapshot().installedAt, {
																includeTime: true,
															}),
														})}
													</p>
												</>
											)}
										</Show>
									</dd>
								</div>
							)}
						</For>
					</dl>
					<Show when={installed()}>
						<p class="border-t px-4 py-3 text-xs text-muted-foreground">
							{t("tagDictionary.schedule")}
						</p>
					</Show>
				</Show>
			</Card>
			<Show when={installed()}>
				<LegacyTagMigration
					actions={props.actions}
					onMigrated={() => {
						void invalidate();
						invalidateLibrary();
					}}
				/>
				<section aria-labelledby={searchTitleId} class="space-y-3">
					<h3 class="text-base font-semibold" id={searchTitleId}>
						{t("tagDictionary.searchTitle")}
					</h3>
					<TagDictionaryBrowser api={props.actions} />
				</section>
			</Show>
		</section>
	);
}
