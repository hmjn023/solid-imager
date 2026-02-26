import { onMount } from "solid-js";
import SwaggerUiBundle from "swagger-ui-dist/swagger-ui-bundle.js";
import "swagger-ui-dist/swagger-ui.css";

export default function swaggerUiComponent() {
	// biome-ignore lint/suspicious/noUnassignedVariables: Assigned by Solid.js ref
	let swaggerUiRef: HTMLDivElement | undefined;

	onMount(() => {
		if (swaggerUiRef) {
			SwaggerUiBundle({
				url: "/openapi.json",
				domNode: swaggerUiRef,
				presets: [SwaggerUiBundle.presets.apis, SwaggerUiBundle.presets.models],
				layout: "BaseLayout",
			});
		}
	});

	return <div ref={swaggerUiRef} />;
}
