// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

const app = document.getElementById("app");

if (app) {
	mount(() => <StartClient />, app);
} else {
	console.error("Element with id 'app' not found.");
}
