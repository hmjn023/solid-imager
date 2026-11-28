import { createEffect } from "solid-js";

/** Observe the edge of a collection only while another page can be fetched. */
export function observePageBoundary(options: {
	target: () => Element | undefined;
	root?: () => Element | undefined;
	enabled: () => boolean;
	rootMargin: string | (() => string);
	load: () => void | Promise<unknown>;
}) {
	createEffect(
		() => {
			const target = options.target();
			if (!target || !options.enabled()) return;
			return {
				target,
				root: options.root?.(),
				rootMargin:
					typeof options.rootMargin === "string"
						? options.rootMargin
						: options.rootMargin(),
			};
		},
		(config) => {
			if (!config) return;
			const { target, root, rootMargin } = config;
			let active = true;
			const observer = new IntersectionObserver(
				(entries) => {
					if (
						entries.some((entry) => entry.isIntersecting) &&
						target.isConnected &&
						active
					) {
						void options.load();
					}
				},
				{ root, rootMargin, threshold: 0.5 },
			);
			observer.observe(target);
			return () => {
				active = false;
				observer.disconnect();
			};
		},
	);
}
