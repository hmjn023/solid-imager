/**
 * Type-safe querySelector that returns a specific HTML element type.
 * Returns null if the element is not found.
 */
export function querySelectorTyped<T extends HTMLElement>(
	parent: Element | Document,
	selector: string,
): T | null {
	return parent.querySelector(selector) as T | null;
}

/**
 * Type-safe querySelector that throws if the element is not found.
 */
export function requireElement<T extends HTMLElement>(
	parent: Element | Document,
	selector: string,
): T {
	const el = parent.querySelector(selector);
	if (!(el instanceof HTMLElement)) {
		throw new Error(`Required element not found: ${selector}`);
	}
	return el as T;
}

/**
 * Type-safe querySelectorAll that returns a typed NodeList.
 */
export function querySelectorAllTyped<T extends HTMLElement>(
	parent: Element | Document,
	selector: string,
): NodeListOf<T> {
	return parent.querySelectorAll(selector) as NodeListOf<T>;
}
