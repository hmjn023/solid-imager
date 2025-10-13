// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";

export default function mountApp() {
  const app = document.getElementById("app");

  if (app) {
    mount(() => <StartClient />, app);
  } else {
    // 何もしません: 'app' IDを持つ要素が見つからないため、マウントするものはありません。
  }
}
