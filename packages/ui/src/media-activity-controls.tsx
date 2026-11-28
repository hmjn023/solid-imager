import Star from "@lucide/solid/icons/star";
import { getLocale, t } from "@solid-imager/i18n";
import type {
	MediaActivity,
	MediaDetails,
	MediaPreferencesPatch,
} from "@solid-imager/core/media";
import { useMutation, useQueryClient } from "@tanstack/solid-query";
import { Rating, RatingItem } from "@ui-sdk/solid/rating";
import { createUniqueId, onSettled, Show } from "solid-js";
import { v7 as uuidv7 } from "uuid";
import { Button } from "./button";
import {
	mediaDetailsQueryKeys,
	searchQueryKeys,
	sourceMediaQueryKeys,
} from "./query-options";
import { toast } from "./toast";
import { Toggle } from "./toggle";

type MediaLocation = { sourceId: string; mediaId: string };
export type MediaActivityApi = {
	recordView(input: MediaLocation & { viewId: string }): Promise<MediaActivity>;
	updatePreferences(
		input: MediaLocation & { data: MediaPreferencesPatch },
	): Promise<MediaActivity>;
};

export function MediaActivityControls(props: {
	media: MediaDetails;
	api: MediaActivityApi;
}) {
	const client = useQueryClient();
	const ratingLabelId = createUniqueId();
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

	const visit = useMutation(() => ({
		mutationFn: (input: MediaLocation & { viewId: string }) =>
			props.api.recordView(input),
		retry: 1,
		onSuccess: ({ viewCount, lastViewedAt }, input) =>
			refresh(input, { viewCount, lastViewedAt }),
	}));
	// Only a mounted detail inspector represents a visit. Prefetches and query refreshes are reads.
	onSettled(() => {
		void visit
			.mutate({ ...location(), viewId: uuidv7() })
			.catch(() => undefined);
	});

	const save = useMutation(() => ({
		mutationFn: (input: MediaLocation & { data: MediaPreferencesPatch }) =>
			props.api.updatePreferences(input),
		onSuccess: ({ rating, favorite }, input) =>
			refresh(input, { rating, favorite }),
		onError: () =>
			toast.error(t("mediaActivityControls.couldNotSaveMediaPreferences")),
	}));
	let savingPreferences = false;
	const savePreferences = async (data: MediaPreferencesPatch) => {
		if (savingPreferences) return;
		savingPreferences = true;
		try {
			await save.mutate({ ...location(), data });
		} catch {
			// The mutation displays the error and leaves the saved preference intact.
		} finally {
			savingPreferences = false;
		}
	};
	const rating = () => props.media.activity?.rating ?? 0;
	const saveRating = (score: number | null) => {
		const nextRating = score ?? 0;
		if (nextRating !== rating()) void savePreferences({ rating: nextRating });
	};
	const lastViewed = () => props.media.activity?.lastViewedAt;

	return (
		<div class="space-y-2">
			<h2 class="font-semibold text-sm">
				{t("mediaActivityControls.activity")}
			</h2>
			<div>
				<Toggle
					class="min-h-11 gap-2 hover:bg-muted hover:text-foreground data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-primary-foreground data-[pressed]:hover:bg-primary-hover data-[pressed]:hover:text-primary-foreground sm:min-h-9"
					disabled={save.isPending}
					onChange={(favorite) => void savePreferences({ favorite })}
					pressed={props.media.activity?.favorite ?? false}
					variant="outline"
				>
					<span aria-hidden="true">
						{props.media.activity?.favorite ? "♥" : "♡"}
					</span>{" "}
					{t("mediaActivityControls.favorite")}
				</Toggle>
			</div>
			<div class="flex flex-wrap items-center gap-x-1">
				<span class="w-full text-muted-foreground text-xs" id={ratingLabelId}>
					{t("sortOptions.rating")}
				</span>
				<Rating
					aria-disabled={save.isPending ? "true" : undefined}
					aria-labelledby={ratingLabelId}
					class="flex shrink-0"
					getValueLabel={(value) =>
						value === 1
							? t("mediaActivityControls.oneStar")
							: t("mediaActivityControls.stars", { count: value })
					}
					onValueChange={(value, details) => {
						// Keep the confirmed rating and the tab stop active during the save.
						details.cancel();
						saveRating(value);
					}}
					value={rating() || null}
				>
					<RatingItem class="grid size-11 place-items-center rounded-md text-muted-foreground data-[filled]:text-primary has-focus-visible:ring-2 has-focus-visible:ring-inset has-focus-visible:ring-ring sm:size-9">
						{(state) => (
							<Star
								aria-hidden="true"
								class="pointer-events-none size-5"
								fill={state.fill === 1 ? "currentColor" : "none"}
							/>
						)}
					</RatingItem>
				</Rating>
				<Button
					aria-disabled={save.isPending ? "true" : undefined}
					aria-pressed={rating() === 0}
					class="min-w-11 px-1.5 aria-pressed:bg-muted"
					onClick={() => saveRating(null)}
					size="sm"
					variant="ghost"
				>
					{t("mediaActivityControls.unrated")}
				</Button>
			</div>
			<p class="text-xs text-muted-foreground">
				{t("mediaActivityControls.viewsValue", {
					value0: String(props.media.activity?.viewCount ?? 0),
				})}
			</p>
			<p class="text-xs text-muted-foreground">
				{t("mediaActivityControls.lastViewed")}{" "}
				<Show
					when={lastViewed()}
					fallback={t("mediaActivityControls.neverViewed")}
				>
					{(date) => (
						<time datetime={date().toISOString()}>
							{date().toLocaleString(getLocale())}
						</time>
					)}
				</Show>
			</p>
			<Show when={visit.isError}>
				<div class="text-xs">
					<output>{t("mediaActivityControls.couldNotRecordThisView")}</output>{" "}
					<Button
						size="sm"
						variant="link"
						onClick={() => {
							if (visit.variables) visit.mutate(visit.variables);
						}}
					>
						{t("actions.retry")}
					</Button>
				</div>
			</Show>
		</div>
	);
}
