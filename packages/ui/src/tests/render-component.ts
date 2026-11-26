import type { JSX } from "@solidjs/web";
import { render } from "@solidjs/web";

export function renderComponent(view: () => JSX.Element) {
	const host = document.body.appendChild(document.createElement("div"));
	const dispose = render(view, host);
	return () => {
		dispose();
		host.remove();
	};
}
