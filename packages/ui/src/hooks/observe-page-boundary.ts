/** Observe the edge of a collection only while another page can be fetched. */
export function observePageBoundary(options: {
	target: () => Element | undefined;
	root?: () => Element | undefined;
	enabled: () => boolean;
	rootMargin: string | (() => string);
	load: () => void | Promise<unknown>;
}) {
	createTrackedEffect(() => {
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
				rootMargin:
					typeof options.rootMargin === "string"
						? options.rootMargin
						: options.rootMargin(),
				threshold: 0.5,
			},
		);
		observer.observe(target);
		return () => {
			active = false;
			observer.disconnect();
		};
	});
}

import { createTrackedEffect } from "solid-js";
