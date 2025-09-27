import type { AppConfig } from "~/lib/types";

export function getConfig() {
  return {};
}

export function updateConfig(config: AppConfig) {
  return { success: true, config };
}

export function resetConfig() {
  return { success: true, message: "Config reset to default" };
}
