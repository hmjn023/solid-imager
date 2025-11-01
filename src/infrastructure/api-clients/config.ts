/**
 * Config API Client
 * Extracted from src/lib/api/config.ts
 */

import type { AppConfig } from "~/domain/shared/types";

// TODO: 設定ファイル（例: config.json）からの読み込みと保存を実装する

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

/**
 * Retrieves the application configuration.
 * Currently returns a default configuration.
 * @returns {AppConfig} The application configuration.
 */
export function getConfig(): AppConfig {
  // 現時点では、デフォルト設定を返します。
  return defaultConfig;
}

/**
 * Updates the application configuration.
 * @param {AppConfig} config - The new configuration object.
 * @returns {object} An object indicating the success of the update and the updated config.
 */
export function updateConfig(config: AppConfig) {
  return { success: true, config };
}

/**
 * Resets the application configuration to its default settings.
 * @returns {object} An object indicating the success of the reset and a message.
 */
export function resetConfig() {
  return { success: true, message: "Config reset to default" };
}
