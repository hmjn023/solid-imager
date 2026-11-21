import type {
	PixivBookmarkChange,
	PixivBookmarkState,
} from "@solid-imager/core/external-viewer";
import { t } from "@solid-imager/i18n";
import {
	createMutation,
	createQuery,
	useQueryClient,
} from "@tanstack/solid-query";
import { createSignal, Match, Show, Switch } from "solid-js";
import { Button } from "../button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogTitle,
	DialogTrigger,
} from "../dialog";
import {
	RadioGroup,
	RadioGroupItem,
	RadioGroupItemLabel,
} from "../radio-group";

export function PixivBookmarkAction(props: {
	id: number;
	title: string;
	scope: (string | number)[];
	load: (id: number) => Promise<PixivBookmarkState>;
	save: (change: PixivBookmarkChange) => Promise<PixivBookmarkState>;
}) {
	const client = useQueryClient();
	const queryKey = () => ["pixiv", "bookmark", props.id, ...props.scope];
	const [open, setOpen] = createSignal(false);
	const [visibility, setVisibility] =
		createSignal<NonNullable<PixivBookmarkChange["visibility"]>>("private");
	const state = createQuery(() => ({
		queryKey: queryKey(),
		queryFn: () => props.load(props.id),
		gcTime: 0,
		staleTime: 15_000,
		retry: false,
	}));
	const change = createMutation(() => ({
		mutationFn: ({
			input,
		}: {
			input: PixivBookmarkChange;
			key: ReturnType<typeof queryKey>;
		}) => props.save(input),
		onSuccess: (result, { key }) => {
			client.setQueryData(key, result);
			setOpen(false);
		},
		retry: false,
	}));

	function submit(next: PixivBookmarkChange["visibility"]) {
		if (!change.isPending)
			change.mutate({
				input: { id: props.id, visibility: next },
				key: queryKey(),
			});
	}

	const title = () => {
		const current = state.data?.visibility;
		if (current === "public") return t("pixivBookmarks.savedPublic");
		if (current === "private") return t("pixivBookmarks.savedPrivate");
		return t("pixivBookmarks.title");
	};
	return (
		<Dialog
			open={open()}
			onOpenChange={(next) => {
				if (!next && change.isPending) return;
				if (next && !change.isPending) change.reset();
				setOpen(next);
			}}
		>
			<DialogTrigger as={Button} class="min-h-11 md:min-h-9" variant="outline">
				{title()}
			</DialogTrigger>
			<DialogContent closeDisabled={change.isPending}>
				<DialogTitle class="pr-12">{title()}</DialogTitle>
				<DialogDescription class="break-words">{props.title}</DialogDescription>
				<Show when={change.isError}>
					<p class="text-destructive text-sm" role="alert">
						{t("pixivBookmarks.changeError")}
					</p>
				</Show>
				<Switch>
					<Match when={state.isPending}>
						<output class="text-muted-foreground text-sm">
							{t("pixivBookmarks.loadingState")}
						</output>
					</Match>
					<Match when={state.isError}>
						<p role="alert" class="text-destructive text-sm">
							{t("pixivBookmarks.stateError")}
						</p>
						<Button variant="outline" onClick={() => void state.refetch()}>
							{t("actions.retry")}
						</Button>
					</Match>
					<Match when={state.data?.visibility}>
						<DialogFooter>
							<Button
								disabled={change.isPending}
								variant="outline"
								onClick={() => setOpen(false)}
							>
								{t("actions.cancel")}
							</Button>
							<Button
								variant="destructive"
								disabled={change.isPending}
								onClick={() => submit(null)}
							>
								{change.isPending
									? t("pixivBookmarks.updating")
									: t("pixivBookmarks.remove")}
							</Button>
						</DialogFooter>
					</Match>
					<Match when={state.data?.canAdd}>
						<RadioGroup
							class="flex flex-wrap gap-4"
							aria-label={t("pixivBookmarks.visibility")}
							value={visibility()}
							disabled={change.isPending}
							onChange={(value) => {
								if (value === "public" || value === "private")
									setVisibility(value);
							}}
						>
							<RadioGroupItem value="public">
								<RadioGroupItemLabel class="flex min-h-11 items-center">
									{t("pixivBookmarks.public")}
								</RadioGroupItemLabel>
							</RadioGroupItem>
							<RadioGroupItem value="private">
								<RadioGroupItemLabel class="flex min-h-11 items-center">
									{t("pixivBookmarks.private")}
								</RadioGroupItemLabel>
							</RadioGroupItem>
						</RadioGroup>
						<DialogFooter>
							<Button
								disabled={change.isPending}
								variant="outline"
								onClick={() => setOpen(false)}
							>
								{t("actions.cancel")}
							</Button>
							<Button
								disabled={change.isPending}
								onClick={() => submit(visibility())}
							>
								{change.isPending
									? t("pixivBookmarks.updating")
									: t("pixivBookmarks.add")}
							</Button>
						</DialogFooter>
					</Match>
					<Match when={state.data}>
						<p class="text-muted-foreground text-sm">
							{t("pixivBookmarks.unavailable")}
						</p>
					</Match>
				</Switch>
			</DialogContent>
		</Dialog>
	);
}
