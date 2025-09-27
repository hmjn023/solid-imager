import type { AppConfig } from "~/lib/types";

// TODO: Implement loading from and saving to a config file (e.g., config.json)

const defaultConfig: AppConfig = {
  media: {
    image: {
      thumbnail: {
        size: { width: 512, height: 512 },
        quality: 80,
      },
    },
  },
};

export function getConfig(): AppConfig {
  // For now, return the default config.
  return defaultConfig;
}

export function updateConfig(config: AppConfig) {
  return { success: true, config };
}

export function resetConfig() {
  return { success: true, message: "Config reset to default" };
}
