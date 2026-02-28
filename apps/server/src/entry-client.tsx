// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

const app = document.getElementById("app");
if (!app) {
  throw new Error("Root element #app not found");
}
/** mount returns a disposal function, exporting it can help with certain HMR scenarios */
export default mount(() => <StartClient />, app);
