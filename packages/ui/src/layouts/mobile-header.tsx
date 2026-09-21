import type { JSX } from "solid-js";
import { Button } from "../button";
import { Menu, Search } from "../workspace/icons";

export function MobileHeader(props: {
	onOpenCommandPalette?: () => void;
	onOpenMenu: () => void;
	renderPendingDownloadsIndicator?: (compact: boolean) => JSX.Element;
	triggerRef?: (element: HTMLButtonElement) => void;
}) {
	return (
		<header class="flex h-13 shrink-0 items-center gap-3 border-[var(--workspace-border)] border-b bg-[var(--workspace-surface-subtle)] px-3 md:hidden">
			<Button
				aria-label="メニューを開く"
				class="size-10 p-0"
				onClick={props.onOpenMenu}
				ref={props.triggerRef}
				size="icon"
				variant="ghost"
			>
				<Menu aria-hidden="true" size={19} />
			</Button>
			<strong class="min-w-0 flex-1 truncate font-semibold">
				Solid Imager
			</strong>
			{props.onOpenCommandPalette ? (
				<Button
					aria-label="Quick actions"
					class="size-10 p-0"
					onClick={props.onOpenCommandPalette}
					size="icon"
					variant="ghost"
				>
					<Search aria-hidden="true" size={18} />
				</Button>
			) : null}
			{props.renderPendingDownloadsIndicator?.(true)}
		</header>
	);
}
