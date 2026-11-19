import type { PixivCard } from "@solid-imager/core/external-viewer";
import { t } from "@solid-imager/i18n";
import { useDialogContext } from "@kobalte/core/dialog";
import { Show } from "solid-js";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogTitle,
	AlertDialogTrigger,
} from "../alert-dialog";
import { EmptyState } from "../async-state";
import { Button } from "../button";
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "../dialog";
import {
	ViewerResultsGrid,
	type ViewerGridItemDescription,
} from "./results-grid";

type PixivViewingHistoryProps = {
	posts: PixivCard[];
	describePost: (post: PixivCard) => ViewerGridItemDescription;
	postHref: (id: number) => string;
	onOpenPost: (id: number) => void;
	onClear: () => void;
};

export function PixivViewingHistoryDialog(
	props: PixivViewingHistoryProps & {
		ready: boolean;
	},
) {
	return (
		<Dialog>
			<DialogTrigger as={Button} variant="outline" disabled={!props.ready}>
				{t("pixivViewingHistory.title")}
			</DialogTrigger>
			<PixivViewingHistoryContent {...props} />
		</Dialog>
	);
}

export function PixivViewingHistoryContent(
	props: PixivViewingHistoryProps & {
		onCloseAutoFocus?: (event: Event) => void;
	},
) {
	const dialog = useDialogContext();
	let title: HTMLElement | undefined;
	return (
		<DialogContent
			class="workspace-theme flex max-w-4xl flex-col gap-3 overflow-hidden"
			onCloseAutoFocus={props.onCloseAutoFocus}
		>
			<DialogTitle
				tabindex="-1"
				ref={(element: HTMLHeadingElement) => {
					title = element;
				}}
				class="shrink-0 pr-8"
			>
				{t("pixivViewingHistory.title")}
			</DialogTitle>
			<div
				class="min-h-0 overflow-y-auto overscroll-contain scrollbar-stable"
				data-media-scroll="pixiv-history"
			>
				<Show
					when={props.posts.length}
					fallback={<EmptyState title={t("pixivViewingHistory.empty")} />}
				>
					<ViewerResultsGrid
						posts={props.posts}
						describe={props.describePost}
						postHref={props.postHref}
						onOpenPost={(id) => {
							dialog.close();
							props.onOpenPost(id);
						}}
					/>
				</Show>
			</div>
			<div class="flex shrink-0 justify-end">
				<AlertDialog>
					<AlertDialogTrigger
						as={Button}
						variant="outline"
						disabled={!props.posts.length}
					>
						{t("pixivViewingHistory.clear")}
					</AlertDialogTrigger>
					<AlertDialogContent
						onCloseAutoFocus={() => {
							if (!props.posts.length) title?.focus({ preventScroll: true });
						}}
					>
						<AlertDialogTitle>
							{t("pixivViewingHistory.confirmClear")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("pixivViewingHistory.clearDescription")}
						</AlertDialogDescription>
						<AlertDialogFooter>
							<AlertDialogCancel>{t("actions.cancel")}</AlertDialogCancel>
							<AlertDialogAction variant="destructive" onClick={props.onClear}>
								{t("pixivViewingHistory.clear")}
							</AlertDialogAction>
						</AlertDialogFooter>
					</AlertDialogContent>
				</AlertDialog>
			</div>
		</DialogContent>
	);
}
