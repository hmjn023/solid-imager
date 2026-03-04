// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

const app = document.getElementById("app");
if (app) {
  mount(() => <StartClient />, app);
} else {
  // biome-ignore lint/suspicious/noConsole: Log error if root element is missing
  console.error("Root element #app not found. Application failed to mount.");
}
