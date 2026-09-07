import {
	BriefcaseBusiness,
	CircleHelp,
	Clock3,
	Database,
	FileText,
	Image,
	Library,
	Settings,
} from "@solid-imager/ui/icons";
import { ShortcutPreferencesProvider } from "@solid-imager/ui/shortcuts/index";
import { Toaster } from "@solid-imager/ui/toast";
import { Link, useLocation } from "@tanstack/solid-router";
import type { JSX, ParentProps } from "solid-js";
import { For } from "solid-js";

const navigationItems = [
	{ icon: Library, label: "Library", to: "/search" },
	{ icon: BriefcaseBusiness, label: "Manager", to: "/manager" },
	{ icon: Clock3, label: "Jobs", to: "/jobs" },
	{ icon: Settings, label: "Settings", to: "/config" },
] as const;

function NavigationItem(props: {
	icon: typeof Library;
	label: string;
	to: string;
}) {
	const location = useLocation();
	const active = () =>
		location().pathname === props.to ||
		(props.to !== "/search" && location().pathname.startsWith(`${props.to}/`));
	const Icon = props.icon;

	return (
		<Link
			aria-current={active() ? "page" : undefined}
			class={`flex h-11 w-full items-center gap-2 rounded-md px-3 font-medium text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)] md:h-10 ${
				active()
					? "bg-[var(--v2-surface-selected)] text-[var(--v2-primary)]"
					: "text-[var(--v2-text-secondary)] hover:bg-[var(--v2-surface-muted)] hover:text-[var(--v2-text)]"
			}`}
			to={props.to}
		>
			<Icon aria-hidden="true" class="shrink-0" size={18} />
			<span class="min-w-0 flex-1 truncate">{props.label}</span>
		</Link>
	);
}

export function TauriV2AppShell(props: ParentProps): JSX.Element {
	return (
		<ShortcutPreferencesProvider>
			<Toaster />
			<div
				class="v2-theme grid h-dvh min-h-0 overflow-hidden bg-[var(--v2-canvas)] text-[var(--v2-text)] md:grid-cols-[216px_minmax(0,1fr)]"
				data-design-version="v2"
			>
				<a
					class="sr-only fixed top-2 left-2 z-[80] rounded-md bg-white px-4 py-2 shadow focus:not-sr-only focus:ring-2 focus:ring-[var(--v2-focus)]"
					href="#v2-main-content"
				>
					メインコンテンツへ移動
				</a>
				<aside
					aria-label="アプリケーションサイドバー"
					class="hidden min-h-0 border-[var(--v2-border)] border-r md:block"
				>
					<div class="flex h-full flex-col overflow-y-auto bg-[var(--v2-surface-subtle)] p-2">
						<Link
							aria-label="Solid Imager Library"
							class="mb-4 flex h-12 items-center gap-2 rounded-md px-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)]"
							to="/search"
						>
							<span class="flex size-8 items-center justify-center rounded-md bg-[var(--v2-primary)] text-white">
								<Image aria-hidden="true" size={17} />
							</span>
							<strong class="truncate font-semibold text-base">
								Solid Imager
							</strong>
						</Link>
						<nav aria-label="主要ナビゲーション" class="space-y-1">
							<For each={navigationItems}>
								{(item) => <NavigationItem {...item} />}
							</For>
						</nav>
						<div class="mt-3 border-[var(--v2-border)] border-t pt-2">
							<NavigationItem icon={Database} label="Sources" to="/sources" />
						</div>
						<div class="mt-auto border-[var(--v2-border)] border-t pt-2">
							<NavigationItem icon={CircleHelp} label="About" to="/about" />
							<a
								class="flex h-10 items-center gap-2 rounded-md px-3 text-[var(--v2-text-muted)] outline-none hover:bg-[var(--v2-surface-muted)] focus-visible:ring-2 focus-visible:ring-[var(--v2-focus)]"
								href="/docs/swagger"
								rel="noopener noreferrer"
								target="_blank"
							>
								<FileText aria-hidden="true" size={18} />
								<span>API Docs</span>
							</a>
						</div>
					</div>
				</aside>

				<div class="flex min-h-0 min-w-0 flex-col">
					<header class="flex h-13 shrink-0 items-center border-[var(--v2-border)] border-b bg-[var(--v2-surface-subtle)] px-4 md:hidden">
						<strong class="truncate font-semibold">Solid Imager</strong>
					</header>
					<main
						class="min-h-0 min-w-0 flex-1 overflow-hidden"
						id="v2-main-content"
						tabIndex={-1}
					>
						{props.children}
					</main>
				</div>
			</div>
		</ShortcutPreferencesProvider>
	);
}
