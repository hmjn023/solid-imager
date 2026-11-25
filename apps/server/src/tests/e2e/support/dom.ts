import type { JSHandle, Locator } from "@playwright/test";
import { expect } from "./test";

/** The action should wait for the resulting UI state before returning. */
export async function expectDomPreserved(
	targets: Record<string, Locator>,
	action: () => Promise<void>,
): Promise<void> {
	const originals: Array<{
		name: string;
		locator: Locator;
		node: JSHandle<Element>;
	}> = [];
	try {
		for (const [name, locator] of Object.entries(targets)) {
			const node = await locator.evaluateHandle((element) => element);
			originals.push({ name, locator, node });
		}
		await action();

		const changed = await Promise.all(
			originals.map(async ({ name, locator, node }) => {
				const preserved = await locator.evaluateAll(
					(elements, original) =>
						elements.length === 1 && elements[0] === original,
					node,
				);
				return preserved ? [] : [name];
			}),
		);
		expect(changed.flat(), "DOM nodes that were replaced or removed").toEqual(
			[],
		);
	} finally {
		await Promise.all(originals.map(({ node }) => node.dispose()));
	}
}
