import { t } from "@solid-imager/i18n";
import type { DialogController } from "@ui-sdk/solid/dialog";
import { createSignal, onSettled, type Accessor } from "solid-js";
import type { JSX } from "@solidjs/web";
import { Button } from "../button";
import { SheetTrigger } from "../sheet";
import { Menu, Search } from "../workspace/icons";

export function MobileHeader(props: {
	menuController: DialogController;
	onOpenCommandPalette?: () => void;
	renderPendingDownloadsIndicator?: (compact: Accessor<boolean>) => JSX.Element;
}) {
	const [menuReady, setMenuReady] = createSignal(false);
	onSettled(() => {
		setMenuReady(true);
	});

	return (
		<header class="flex h-14 shrink-0 items-center gap-3 border-border border-b bg-background px-3 md:hidden">
			<SheetTrigger
				aria-label={t("mobileHeader.openMenu")}
				as={Button}
				class="size-11 p-0"
				controller={props.menuController}
				disabled={!menuReady()}
				size="icon"
				variant="ghost"
			>
				<Menu aria-hidden="true" size={19} />
			</SheetTrigger>
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
