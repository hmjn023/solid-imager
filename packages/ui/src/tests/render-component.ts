import type { JSX } from "solid-js";
import { render } from "solid-js/web";

export function renderComponent(view: () => JSX.Element) {
	const host = document.body.appendChild(document.createElement("div"));
	const dispose = render(view, host);
	return () => {
		dispose();
		host.remove();
	};
}
