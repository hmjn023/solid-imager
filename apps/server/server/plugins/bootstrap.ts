import { startBackgroundWorker } from "../../src/infrastructure/bootstrap";

export default function (nitroApp: any) {
  console.log("[Nitro Plugin] Initializing services and starting background worker...");
  startBackgroundWorker();
}
