import { Button } from "@solid-imager/ui/button";
import { Menu } from "@solid-imager/ui/v2/icons";
import { PendingDownloadsIndicator } from "~/components/imports/pending-downloads-indicator";

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
			<PendingDownloadsIndicator compact variant="v2" />
		</header>
	);
}
