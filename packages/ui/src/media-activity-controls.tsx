import type {
	MediaActivity,
	MediaDetails,
	MediaPreferencesPatch,
} from "@solid-imager/core/domain/media/schemas";
import { createMutation, useQueryClient } from "@tanstack/solid-query";
import { onMount, Show } from "solid-js";
import { v7 as uuidv7 } from "uuid";
import { Button } from "./button";
import {
	mediaDetailsQueryKeys,
	searchQueryKeys,
	sourceMediaQueryKeys,
} from "./query-options";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "./select";
import { toast } from "./toast";

type MediaLocation = { sourceId: string; mediaId: string };
export type MediaActivityApi = {
	recordView(input: MediaLocation & { viewId: string }): Promise<MediaActivity>;
	updatePreferences(
		input: MediaLocation & { data: MediaPreferencesPatch },
	): Promise<MediaActivity>;
};

const ratings = [
	"Unrated",
	"1 star",
	"2 stars",
	"3 stars",
	"4 stars",
	"5 stars",
];

export function MediaActivityControls(props: {
	media: MediaDetails;
	api: MediaActivityApi;
}) {
	const client = useQueryClient();
	const location = () => ({
		sourceId: props.media.mediaSourceId,
		mediaId: props.media.id,
	});
	const refresh = (
		{ sourceId, mediaId }: MediaLocation,
		patch: Partial<MediaActivity>,
	) => {
		const queryKey = mediaDetailsQueryKeys.detail(sourceId, mediaId);
		client.setQueryData<MediaDetails>(
			queryKey,
			(old) =>
				old && {
					...old,
					activity: { ...old.activity, ...patch },
				},
		);
		if (client.isFetching({ queryKey }))
			void client.invalidateQueries({ queryKey });
		void client.invalidateQueries({
			queryKey: searchQueryKeys.all(),
			predicate: (query) => query.meta?.usesMediaActivity === true,
		});
		void client.invalidateQueries({
			queryKey: sourceMediaQueryKeys.forSource(sourceId),
			predicate: (query) => query.meta?.usesMediaActivity === true,
		});
	};

	const visit = createMutation(() => ({
		mutationFn: (input: MediaLocation & { viewId: string }) =>
			props.api.recordView(input),
		retry: 1,
		onSuccess: ({ viewCount, lastViewedAt }, input) =>
			refresh(input, { viewCount, lastViewedAt }),
	}));
	// Only a mounted detail inspector represents a visit. Prefetches and query refreshes are reads.
	onMount(() => visit.mutate({ ...location(), viewId: uuidv7() }));

	const save = createMutation(() => ({
		mutationFn: (input: MediaLocation & { data: MediaPreferencesPatch }) =>
			props.api.updatePreferences(input),
		onSuccess: ({ rating, favorite }, input) =>
			refresh(input, { rating, favorite }),
		onError: () => toast.error("Could not save media preferences"),
	}));
	const lastViewed = () => props.media.activity?.lastViewedAt;

	return (
		<div class="space-y-2">
			<h2 class="font-semibold text-sm">Activity</h2>
			<div class="flex flex-wrap items-center gap-2">
				<Button
					aria-pressed={props.media.activity?.favorite ?? false}
					disabled={save.isPending}
					variant={props.media.activity?.favorite ? "default" : "outline"}
					onClick={() =>
						save.mutate({
							...location(),
							data: { favorite: !props.media.activity?.favorite },
						})
					}
				>
					<span aria-hidden="true">
						{props.media.activity?.favorite ? "♥" : "♡"}
					</span>{" "}
					Favorite
				</Button>
				<Select
					options={ratings}
					value={ratings[props.media.activity?.rating ?? 0]}
					disabled={save.isPending}
					onChange={(value) => {
						if (value && value !== ratings[props.media.activity?.rating ?? 0]) {
							save.mutate({
								...location(),
								data: { rating: ratings.indexOf(value) },
							});
						}
					}}
					itemComponent={(item) => (
						<SelectItem item={item.item}>{item.item.rawValue}</SelectItem>
					)}
				>
					<SelectTrigger aria-label="Rating" class="min-h-11 w-auto gap-2">
						<SelectValue<string>>
							{(state) => state.selectedOption()}
						</SelectValue>
					</SelectTrigger>
					<SelectContent />
				</Select>
			</div>
			<p class="text-xs text-muted-foreground">
				Views: {props.media.activity?.viewCount ?? 0}
			</p>
			<p class="text-xs text-muted-foreground">
				Last viewed:{" "}
				<Show when={lastViewed()} fallback="Never">
					{(date) => (
						<time dateTime={date().toISOString()}>
							{date().toLocaleString()}
						</time>
					)}
				</Show>
			</p>
			<Show when={visit.isError}>
				<div class="text-xs">
					<output>Could not record this view.</output>{" "}
					<Button
						size="sm"
						variant="link"
						onClick={() => {
							if (visit.variables) visit.mutate(visit.variables);
						}}
					>
						Retry
					</Button>
				</div>
			</Show>
		</div>
	);
}
