import { Button } from "@solid-imager/ui/button";
import { Menu } from "@solid-imager/ui/v2/icons";
import { V2PendingDownloadsIndicator } from "~/components/imports/v2-pending-downloads-indicator";

export function V2MobileHeader(props: { onOpenMenu: () => void }) {
	return (
		<header class="flex h-13 shrink-0 items-center gap-3 border-[var(--v2-border)] border-b bg-[var(--v2-surface-subtle)] px-3 md:hidden">
			<Button
				aria-label="メニューを開く"
				class="size-10 p-0"
				onClick={props.onOpenMenu}
				size="icon"
				variant="ghost"
			>
				<Menu aria-hidden="true" size={19} />
			</Button>
			<strong class="min-w-0 flex-1 truncate font-semibold">
				Solid Imager
			</strong>
			<V2PendingDownloadsIndicator compact />
		</header>
	);
}
