import { onMount } from "solid-js";
import SwaggerUi from "swagger-ui-dist/swagger-ui-bundle.js";
import "swagger-ui-dist/swagger-ui.css";

export default function swaggerUiComponent() {
  const swaggerUiRef: HTMLDivElement | null = null;

  onMount(() => {
    if (swaggerUiRef) {
      SwaggerUi({
        url: "/openapi.json",
        domNode: swaggerUiRef,
        presets: [SwaggerUi.presets.apis, SwaggerUi.presets.models],
        layout: "BaseLayout",
      });
    }
  });

  return <div ref={swaggerUiRef} />;
}
