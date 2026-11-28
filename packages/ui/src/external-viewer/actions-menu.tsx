import { t } from "@solid-imager/i18n";
import Ellipsis from "@lucide/solid/icons/ellipsis";
import Globe from "@lucide/solid/icons/globe";
import type { JSX } from "@solidjs/web";
import { Button } from "../button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "../dropdown-menu";

export function ViewerActionsMenu(props: {
	siteUrl: string;
	children?: JSX.Element;
	triggerRef?: (element: HTMLButtonElement) => void;
	onCloseAutoFocus?: (event: Event) => void;
}) {
	return (
		<DropdownMenu placement="bottom-end">
			<DropdownMenuTrigger
				ref={(element: HTMLButtonElement) => props.triggerRef?.(element)}
				as={Button}
				variant="outline"
				size="icon"
				class="size-11 shrink-0 sm:size-11"
				aria-label={t("mediaActions.moreActions")}
				title={t("mediaActions.moreActions")}
			>
				<Ellipsis aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent
				class="workspace-theme min-w-48"
				onCloseAutoFocus={props.onCloseAutoFocus}
			>
				{props.children}
				<DropdownMenuItem
					as="a"
					class="min-h-11"
					href={props.siteUrl}
					target="_blank"
					rel="noopener noreferrer"
				>
					<Globe aria-hidden="true" size={16} />
					{t("workspace.openSite")}
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
