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
import { For, Show } from "solid-js";
import { isServer } from "solid-js/web";
import { ErrorState } from "../../async-state";
import { Button } from "../../button";
import {
	type JobEventStreamFactory,
	useJobEvents,
} from "../../hooks/use-job-events";
import { TagDictionaryBrowser } from "../../tag-dictionary-browser";
import {
	searchQueryKeys,
	sourceMediaQueryKeys,
} from "../../query-options/search-query";
import {
	TAG_DICTIONARY_QUERY_KEY,
	tagsQueryKeys,
} from "../../query-options/tags-query";
import {
	LegacyTagMigration,
	type LegacyTagMigrationActions,
} from "./legacy-tag-migration";
import { formatDate } from "./utils";

export type TagDictionaryActions = LegacyTagMigrationActions & {
	dictionaryStatus: () => Promise<TagDictionaryStatus>;
	dictionaryRefresh: () => Promise<TagDictionaryStatus>;
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
		onSuccess: (data) => {
			client.setQueryData(STATUS_QUERY_KEY, data);
			void invalidate();
		},
	}));
	useJobEvents(
		async (signal) => {
			const stream = await props.actions.openJobEvents(signal);
			void invalidate();
			return stream;
		},
		(event) => {
			const currentJob = event.data.jobId === status.data?.job?.id;
			if (
				currentJob ||
				(event.event === "job-progress" && event.data.created)
			) {
				void invalidate();
			}
			if (
				currentJob &&
				(event.event === "job-completed" ||
					event.event === "job-failed" ||
					event.event === "job-cancelled")
			) {
				invalidateLibrary();
			}
		},
	);
	const active = () =>
		status.data?.job?.status === "pending" ||
		status.data?.job?.status === "in_progress";
	const snapshotFor = (source: TagDictionarySource) =>
		status.data?.snapshots.find((snapshot) => snapshot.source === source);

	return (
		<section class="space-y-4">
			<div class="flex flex-wrap items-start justify-between gap-3">
				<div class="space-y-1">
					<h2 class="text-base font-semibold">{t("tagDictionary.title")}</h2>
					<p class="text-sm text-muted-foreground">
						{t("tagDictionary.schedule")}
					</p>
				</div>
				<Button
					type="button"
					class="min-h-11 sm:min-h-9"
					disabled={status.isPending || refresh.isPending || active()}
					onClick={() => refresh.mutate()}
				>
					{t(
						snapshotFor("tags")
							? "tagDictionary.refresh"
							: "tagDictionary.install",
					)}
				</Button>
			</div>
			<Show when={status.isError}>
				<ErrorState
					title={t("tagDictionary.statusError")}
					onRetry={() => void status.refetch()}
				/>
			</Show>
			<div aria-live="polite" aria-atomic="true" class="space-y-1 text-sm">
				<Show when={refresh.isError}>
					<p class="text-destructive">{t("tagDictionary.refreshError")}</p>
				</Show>
				<Show when={status.data?.job}>
					{(job) => (
						<>
							<p>
								{t("tagDictionary.lastCheck", {
									status: t(JOB_LABELS[job().status]),
									date: formatDate(job().updatedAt, { includeTime: true }),
								})}
							</p>
							<Show when={job().error}>
								<p class="break-words text-destructive">{job().error}</p>
							</Show>
						</>
					)}
				</Show>
			</div>
			<dl class="divide-y divide-border rounded-lg border border-border">
				<For each={SOURCES}>
					{(source) => (
						<div class="grid gap-1 px-3 py-2 text-sm sm:grid-cols-2">
							<dt>
								<a
									class="font-medium underline-offset-4 hover:underline"
									href={source.url}
									target="_blank"
									rel="noreferrer"
								>
									{t(source.labelKey)}
								</a>
							</dt>
							<dd class="break-words text-muted-foreground">
								<Show
									when={snapshotFor(source.id)}
									fallback={t("tagDictionary.notInstalled")}
								>
									{(snapshot) =>
										t("tagDictionary.snapshotStatus", {
											version:
												source.id === "tags"
													? formatDate(snapshot().version)
													: snapshot().version,
											count: snapshot().count.toLocaleString(getLocale()),
											date: formatDate(snapshot().installedAt, {
												includeTime: true,
											}),
										})
									}
								</Show>
							</dd>
						</div>
					)}
				</For>
			</dl>
			<Show when={snapshotFor("tags")}>
				<LegacyTagMigration
					actions={props.actions}
					onMigrated={() => {
						void invalidate();
						invalidateLibrary();
					}}
				/>
			</Show>
			<TagDictionaryBrowser api={props.actions} />
		</section>
	);
}
