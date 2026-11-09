import { createEffect, onCleanup } from "solid-js";

/** Observe the edge of a collection only while another page can be fetched. */
export function observePageBoundary(options: {
	target: () => Element | undefined;
	root?: () => Element | undefined;
	enabled: () => boolean;
	rootMargin: string;
	load: () => Promise<unknown>;
}) {
	createEffect(() => {
		const target = options.target();
		if (!target || !options.enabled()) return;
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
			{
				root: options.root?.(),
				rootMargin: options.rootMargin,
				threshold: 0.5,
			},
		);
		observer.observe(target);
		onCleanup(() => {
			active = false;
			observer.disconnect();
		});
	});
}
