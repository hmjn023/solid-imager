export function resolveScrollContainer(
	selector: string | undefined,
): HTMLElement | null {
	if (!selector || typeof document === "undefined") return null;
	return document.querySelector<HTMLElement>(selector);
}

export function scrollToPosition(
	selector: string | undefined,
	top: number,
): boolean {
	if (selector) {
		const container = resolveScrollContainer(selector);
		if (!container) return false;
		container.scrollTo({ top });
		return true;
	}
	if (typeof window === "undefined") return false;
	window.scrollTo(0, top);
	return true;
}

export function currentScrollPosition(
	selector: string | undefined,
): number | null {
	if (selector) return resolveScrollContainer(selector)?.scrollTop ?? null;
	return typeof window === "undefined" ? null : window.scrollY;
}
