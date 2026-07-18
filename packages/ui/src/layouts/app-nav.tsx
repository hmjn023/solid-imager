import {
	CloseButton as DialogCloseButton,
	Content as DialogContent,
	Overlay as DialogOverlay,
	Portal as DialogPortal,
	Root as DialogRoot,
	Title as DialogTitle,
	Trigger as DialogTrigger,
} from "@kobalte/core/dialog";
import { Link, useLocation } from "@tanstack/solid-router";
import type { JSX } from "solid-js";
import { createSignal, onCleanup, onMount, Show } from "solid-js";
import { isServer } from "solid-js/web";

type AppNavProps = {
	pendingDownloadsIndicator?: JSX.Element;
};

const navigationItems = [
	{ label: "Home", to: "/" },
	{ label: "Sources", to: "/sources" },
	{ label: "Search", to: "/search" },
	{ label: "Manager", to: "/manager" },
	{ label: "About", to: "/about" },
	{ label: "Settings", to: "/config" },
] as const;

export function AppNav(props: AppNavProps) {
	const location = useLocation();
	const [isMenuOpen, setIsMenuOpen] = createSignal(false);
	const [isClient, setIsClient] = createSignal(false);
	const isActive = (path: string) => path === location().pathname;
	const linkClass = (path: string) =>
		`rounded-md px-3 py-2 font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-sky-800 ${
			isActive(path)
				? "bg-sky-700 text-white"
				: "text-sky-50 hover:bg-sky-700 hover:text-white"
		}`;

	const [isVisible, setIsVisible] = createSignal(true);
	const [lastScrollY, setLastScrollY] = createSignal(0);

	const handleScroll = () => {
		if (!window.matchMedia("(min-width: 768px)").matches) {
			setIsVisible(true);
			return;
		}

		const currentScrollY = window.scrollY;

		if (currentScrollY < 0) {
			return;
		}

		const hideThreshold = 50;

		if (currentScrollY < lastScrollY() || currentScrollY < 10) {
			setIsVisible(true);
		} else if (
			currentScrollY > lastScrollY() &&
			currentScrollY > hideThreshold
		) {
			setIsVisible(false);
		}

		setLastScrollY(currentScrollY);
	};

	onMount(() => {
		setIsClient(true);
		window.addEventListener("scroll", handleScroll, { passive: true });
	});

	onCleanup(() => {
		if (isServer) {
			return;
		}
		window.removeEventListener("scroll", handleScroll);
	});

	return (
		<>
			<a
				class="sr-only fixed top-2 left-2 z-[60] rounded-md bg-background px-4 py-2 text-foreground shadow focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-ring"
				href="#main-content"
			>
				メインコンテンツへ移動
			</a>
			<nav
				aria-label="主要ナビゲーション"
				class={`fixed top-0 right-0 left-0 z-50 w-full bg-sky-800 transition-transform duration-300 ${
					isVisible() ? "translate-y-0" : "-translate-y-full"
				}`}
			>
				<div class="container flex min-h-16 items-center gap-2 px-3 pt-[env(safe-area-inset-top)] sm:px-4">
					<Link
						class="rounded-md px-2 py-2 font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
						to="/"
					>
						Solid Imager
					</Link>
					<ul class="hidden items-center gap-1 md:flex">
						{navigationItems.map((item) => (
							<li>
								<Link
									aria-current={isActive(item.to) ? "page" : undefined}
									class={linkClass(item.to)}
									to={item.to}
								>
									{item.label}
								</Link>
							</li>
						))}
						<li>
							<a
								class={linkClass("/docs")}
								href="/docs/index.html"
								rel="noopener noreferrer"
								target="_blank"
							>
								Docs
							</a>
						</li>
					</ul>
					<div class="ml-auto flex items-center gap-2" id="nav-actions">
						{props.pendingDownloadsIndicator}
						<DialogRoot onOpenChange={setIsMenuOpen} open={isMenuOpen()}>
							<DialogTrigger
								aria-label="メニューを開く"
								class="inline-flex size-11 items-center justify-center rounded-md text-white hover:bg-sky-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:hidden"
							>
								<svg
									aria-hidden="true"
									fill="none"
									stroke="currentColor"
									stroke-width="2"
									viewBox="0 0 24 24"
								>
									<path d="M4 6h16M4 12h16M4 18h16" />
								</svg>
							</DialogTrigger>
							<Show when={isClient()}>
								<DialogPortal>
									<DialogOverlay class="fixed inset-0 z-[60] bg-black/50 data-[closed]:animate-out data-[expanded]:animate-in" />
									<DialogContent
										aria-labelledby="mobile-navigation-title"
										class="fixed inset-y-0 right-0 z-[70] flex w-[min(20rem,calc(100vw-1rem))] flex-col bg-background pb-[env(safe-area-inset-bottom)] shadow-xl outline-none data-[closed]:animate-out data-[closed]:slide-out-to-right data-[expanded]:animate-in data-[expanded]:slide-in-from-right"
									>
										<div class="flex min-h-16 items-center justify-between border-b px-4 pt-[env(safe-area-inset-top)]">
											<DialogTitle
												class="font-semibold text-lg"
												id="mobile-navigation-title"
											>
												メニュー
											</DialogTitle>
											<DialogCloseButton
												aria-label="メニューを閉じる"
												class="inline-flex size-11 items-center justify-center rounded-md hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
											>
												<svg
													aria-hidden="true"
													fill="none"
													stroke="currentColor"
													stroke-width="2"
													viewBox="0 0 24 24"
												>
													<path d="M18 6 6 18M6 6l12 12" />
												</svg>
											</DialogCloseButton>
										</div>
										<nav
											aria-label="モバイルナビゲーション"
											class="overflow-y-auto p-3"
										>
											<ul class="space-y-1">
												{navigationItems.map((item) => (
													<li>
														<Link
															aria-current={
																isActive(item.to) ? "page" : undefined
															}
															class={`block min-h-11 ${linkClass(item.to)}`}
															onClick={() => setIsMenuOpen(false)}
															to={item.to}
														>
															{item.label}
														</Link>
													</li>
												))}
												<li>
													<a
														class={`block min-h-11 ${linkClass("/docs")}`}
														href="/docs/index.html"
														rel="noopener noreferrer"
														target="_blank"
													>
														Docs
													</a>
												</li>
											</ul>
										</nav>
									</DialogContent>
								</DialogPortal>
							</Show>
						</DialogRoot>
					</div>
				</div>
			</nav>
			<div
				aria-hidden="true"
				class="h-[calc(4rem+env(safe-area-inset-top))] shrink-0"
			/>
		</>
	);
}
