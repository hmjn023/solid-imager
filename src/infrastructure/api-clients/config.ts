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

export function getConfig(): AppConfig {
  // 現時点では、デフォルト設定を返します。
  return defaultConfig;
}

export function updateConfig(config: AppConfig) {
  return { success: true, config };
}

export function resetConfig() {
  return { success: true, message: "Config reset to default" };
}
