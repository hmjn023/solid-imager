import { Link, useLocation } from "@tanstack/solid-router";
import type { JSX } from "solid-js";
import { createSignal, onCleanup, onMount } from "solid-js";
import { isServer } from "solid-js/web";

type AppNavProps = {
	pendingDownloadsIndicator?: JSX.Element;
};

export function AppNav(props: AppNavProps) {
	const location = useLocation();
	const active = (path: string) =>
		path === location().pathname
			? "border-sky-600"
			: "border-transparent hover:border-sky-600";

	const [isVisible, setIsVisible] = createSignal(true);
	const [lastScrollY, setLastScrollY] = createSignal(0);

	const handleScroll = () => {
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
			<nav
				class={`fixed top-0 right-0 left-0 z-50 w-full bg-sky-800 transition-transform duration-300 ${
					isVisible() ? "translate-y-0" : "-translate-y-full"
				}`}
			>
				<div class="container relative flex items-center p-3">
					<ul class="flex items-center text-gray-200">
						<li class={`border-b-2 ${active("/")} mx-1.5 sm:mx-6`}>
							<Link to="/">Home</Link>
						</li>
						<li class={`border-b-2 ${active("/about")} mx-1.5 sm:mx-6`}>
							<Link to="/about">About</Link>
						</li>
						<li class={`border-b-2 ${active("/sources")} mx-1.5 sm:mx-6`}>
							<Link to="/sources">Sources</Link>
						</li>
						<li class={`border-b-2 ${active("/search")} mx-1.5 sm:mx-6`}>
							<Link to="/search">Search</Link>
						</li>
						<li class={`border-b-2 ${active("/manager")} mx-1.5 sm:mx-6`}>
							<Link to="/manager">Manager</Link>
						</li>
						<li class={`border-b-2 ${active("/docs")} mx-1.5 sm:mx-6`}>
							<a
								href="/docs/index.html"
								rel="noopener noreferrer"
								target="_blank"
							>
								Docs
							</a>
						</li>
						<li class={`border-b-2 ${active("/config")} mx-1.5 sm:mx-6`}>
							<Link to="/config">Settings</Link>
						</li>
					</ul>
					<div class="ml-auto flex items-center gap-2" id="nav-actions">
						{props.pendingDownloadsIndicator}
					</div>
				</div>
			</nav>
			<div class="h-[52px]" />
		</>
	);
}
