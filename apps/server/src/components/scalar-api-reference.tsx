import { createApiReference } from "@scalar/api-reference";
import "@scalar/api-reference/style.css";
import { onCleanup, onMount } from "solid-js";

export function ScalarApiReference() {
	let referenceElement: HTMLDivElement | undefined;

	onMount(() => {
		if (!referenceElement) {
			return;
		}

		const reference = createApiReference(referenceElement, {
			url: "/openapi.json",
			layout: "modern",
		});

		onCleanup(() => reference.destroy());
	});

	return <div class="min-h-screen" ref={referenceElement} />;
}
