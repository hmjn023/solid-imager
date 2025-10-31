import { onMount } from "solid-js";
import SwaggerUI from "swagger-ui-dist/swagger-ui-bundle.js";
import "swagger-ui-dist/swagger-ui.css";

export default function SwaggerUIComponent() {
  let swaggerUiRef: HTMLDivElement | undefined;

  onMount(() => {
    if (swaggerUiRef) {
      SwaggerUI({
        url: "/openapi.json",
        domNode: swaggerUiRef,
        presets: [
          SwaggerUI.presets.apis,
          SwaggerUI.presets.models,
        ],
        layout: "BaseLayout",
      });
    }
  });

  return <div ref={swaggerUiRef} />;
}
