import {
	elementScroll,
	observeElementOffset,
	observeElementRect,
	observeWindowOffset,
	observeWindowRect,
	Virtualizer,
	windowScroll,
	type PartialKeys,
	type VirtualizerOptions,
} from "@tanstack/virtual-core";
import {
	createEffect,
	createSignal,
	createStore,
	onCleanup,
	reconcile,
	untrack,
} from "solid-js";

export { defaultRangeExtractor } from "@tanstack/virtual-core";
export type { Range, Virtualizer, VirtualItem } from "@tanstack/virtual-core";

function createVirtualizerBase<
	TScroll extends Element | Window,
	TItem extends Element,
>(
	options: () => VirtualizerOptions<TScroll, TItem>,
): Virtualizer<TScroll, TItem> {
	const instance = new Virtualizer(untrack(options));
	const [items, setItems] = createStore(untrack(instance.getVirtualItems));
	const [size, setSize] = createSignal(untrack(instance.getTotalSize));

	const publish = () => {
		setItems(reconcile(instance.getVirtualItems(), (item) => item.index));
		setSize(instance.getTotalSize());
	};
	onCleanup(instance._didMount());
	createEffect(
		() => {
			const resolved = options();
			const scrollElement =
				resolved.enabled === false ? null : resolved.getScrollElement();
			return { ...resolved, getScrollElement: () => scrollElement };
		},
		(resolved) => {
			instance.setOptions({
				...resolved,
				onChange: (current, sync) => {
					current._willUpdate();
					publish();
					resolved.onChange?.(current, sync);
				},
			});
			instance._willUpdate();
			publish();
		},
	);

	return new Proxy(instance, {
		get(target, key, receiver) {
			if (key === "getVirtualItems") return () => items;
			if (key === "getTotalSize") return size;
			return Reflect.get(target, key, receiver);
		},
	});
}

type SharedDefaults =
	| "observeElementRect"
	| "observeElementOffset"
	| "scrollToFn";
type WindowDefaults = SharedDefaults | "getScrollElement" | "initialOffset";

export function createVirtualizer<
	TScroll extends Element,
	TItem extends Element,
>(options: PartialKeys<VirtualizerOptions<TScroll, TItem>, SharedDefaults>) {
	return createVirtualizerBase<TScroll, TItem>(() => ({
		observeElementRect,
		observeElementOffset,
		scrollToFn: elementScroll,
		...options,
	}));
}

export function createWindowVirtualizer<TItem extends Element>(
	options: PartialKeys<VirtualizerOptions<Window, TItem>, WindowDefaults>,
) {
	return createVirtualizerBase<Window, TItem>(() => ({
		getScrollElement: () => (typeof window === "undefined" ? null : window),
		observeElementRect: observeWindowRect,
		observeElementOffset: observeWindowOffset,
		scrollToFn: windowScroll,
		initialOffset: () => (typeof window === "undefined" ? 0 : window.scrollY),
		...options,
	}));
}
