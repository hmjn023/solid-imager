import { Link, useLocation } from "@tanstack/solid-router";
import { createSignal, onCleanup, onMount } from "solid-js";

const navigationItems = [
	{ to: "/", label: "Home" },
	{ to: "/about", label: "About" },
	{ to: "/sources", label: "Sources" },
	{ to: "/search", label: "Search" },
	{ to: "/manager", label: "Manager" },
	{ to: "/config", label: "Settings" },
] as const;

export function Nav() {
	const location = useLocation();
	const [isVisible, setIsVisible] = createSignal(true);
	const [lastScrollY, setLastScrollY] = createSignal(0);

	const activeClass = (path: string) =>
		path === location().pathname
			? "border-sky-600 text-white"
			: "border-transparent text-gray-200 hover:border-sky-600 hover:text-white";

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
		window.removeEventListener("scroll", handleScroll);
	});

	return (
		<>
			<nav
				class={`fixed top-0 right-0 left-0 z-50 w-full bg-sky-800 transition-transform duration-300 ${
					isVisible() ? "translate-y-0" : "-translate-y-full"
				}`}
			>
				<div class="container flex items-center gap-4 p-3">
					<div>
						<p class="font-semibold text-white text-sm tracking-[0.25em] uppercase">
							Solid Imager
						</p>
						<p class="text-sky-100 text-xs">Standalone desktop UI</p>
					</div>
					<ul class="ml-auto flex items-center text-sm">
						{navigationItems.map((item) => (
							<li class={`mx-1.5 border-b-2 sm:mx-4 ${activeClass(item.to)}`}>
								<Link to={item.to}>{item.label}</Link>
							</li>
						))}
					</ul>
				</div>
			</nav>
			<div class="h-[60px]" />
		</>
	);
}
