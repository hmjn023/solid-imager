// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

/**
 * Mounts the SolidStart client application to the DOM.
 * It targets the HTML element with the ID "app" and renders the application within it.
 */
export default function mountApp() {
  const app = document.getElementById("app");

  if (app) {
    mount(() => <StartClient />, app);
  } else {
    // 何もしません: 'app' IDを持つ要素が見つからないため、マウントするものはありません。
  }
}
