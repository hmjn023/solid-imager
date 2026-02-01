import type { AppConfig } from "@/domain/config/config-schema";

export interface IConfigService {
  getConfig(): AppConfig;
  updateConfig(config: Partial<AppConfig>): Promise<void>;
  onChange(callback: (config: AppConfig) => void): void;
}
