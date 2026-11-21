import { t } from "@solid-imager/i18n";
import { useDialogContext } from "@kobalte/core/dialog";
import { For, Show } from "solid-js";
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
import { DialogContent, DialogTitle } from "../dialog";
import type { ViewerSearchHistoryEntry } from "./viewer-search-history";

export function ViewerSearchHistoryContent(props: {
	entries: ViewerSearchHistoryEntry[];
	onSelect: (entry: ViewerSearchHistoryEntry) => void;
	onClear: () => void;
	onCloseAutoFocus: (event: Event) => void;
}) {
	const dialog = useDialogContext();
	let title: HTMLHeadingElement | undefined;
	return (
		<DialogContent
			class="workspace-theme flex flex-col gap-3 overflow-hidden"
			onCloseAutoFocus={props.onCloseAutoFocus}
		>
			<DialogTitle
				tabindex="-1"
				ref={(element: HTMLHeadingElement) => {
					title = element;
				}}
				class="shrink-0 pr-12"
			>
				{t("viewerSearchHistory.title")}
			</DialogTitle>
			<div class="min-h-0 overflow-y-auto overscroll-contain scrollbar-stable">
				<Show
					when={props.entries.length}
					fallback={<EmptyState title={t("viewerSearchHistory.empty")} />}
				>
					<ol class="divide-y divide-border">
						<For each={props.entries}>
							{(entry) => (
								<li class="py-1">
									<Button
										type="button"
										variant="ghost"
										class="h-auto min-h-11 w-full flex-col items-start gap-1 whitespace-normal break-all px-2 text-left"
										onClick={() => {
											dialog.close();
											props.onSelect(entry);
										}}
									>
										<span>{entry.tags}</span>
										<Show
											when={
												entry.literalPixivTag ||
												Object.keys(entry.choices).length
											}
										>
											<span class="text-muted-foreground text-xs">
												{entry.literalPixivTag
													? t("viewerSearchHistory.exactPixivTag")
													: Object.values(entry.choices).join(" · ")}
											</span>
										</Show>
									</Button>
								</li>
							)}
						</For>
					</ol>
				</Show>
			</div>
			<div class="flex shrink-0 justify-end">
				<AlertDialog>
					<AlertDialogTrigger
						as={Button}
						variant="outline"
						disabled={!props.entries.length}
					>
						{t("pixivViewingHistory.clear")}
					</AlertDialogTrigger>
					<AlertDialogContent
						onCloseAutoFocus={() => {
							if (!props.entries.length) title?.focus({ preventScroll: true });
						}}
					>
						<AlertDialogTitle>
							{t("viewerSearchHistory.confirmClear")}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{t("viewerSearchHistory.clearDescription")}
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
