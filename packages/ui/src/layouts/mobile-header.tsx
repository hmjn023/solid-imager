import { t } from "@solid-imager/i18n";
import { createSignal, onSettled, type Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "../button";
import { Menu, Search } from "../workspace/icons";

export function MobileHeader(props: {
	onOpenCommandPalette?: () => void;
	onOpenMenu: () => void;
	renderPendingDownloadsIndicator?: (compact: Accessor<boolean>) => JSX.Element;
	triggerRef?: (element: HTMLButtonElement) => void;
}) {
	const [menuReady, setMenuReady] = createSignal(false);
	onSettled(() => {
		setMenuReady(true);
	});

	return (
		<header class="flex h-14 shrink-0 items-center gap-3 border-border border-b bg-background px-3 md:hidden">
			<Button
				aria-label={t("mobileHeader.openMenu")}
				class="size-11 p-0"
				disabled={!menuReady()}
				onClick={props.onOpenMenu}
				ref={props.triggerRef}
				size="icon"
				variant="ghost"
			>
				<Menu aria-hidden="true" size={19} />
			</Button>
			<strong class="min-w-0 flex-1 truncate font-semibold">
				{t("sidebar.solidImager")}
			</strong>
			{props.onOpenCommandPalette ? (
				<Button
					aria-label={t("sidebar.quickActions")}
					class="size-11 p-0"
					onClick={props.onOpenCommandPalette}
					size="icon"
					variant="ghost"
				>
					<Search aria-hidden="true" size={18} />
				</Button>
			) : null}
			{props.renderPendingDownloadsIndicator?.(() => true)}
		</header>
	);
}
