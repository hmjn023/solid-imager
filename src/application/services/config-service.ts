import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import {
  type AppConfig,
  AppConfigSchema,
  defaultAppConfig,
} from "~/domain/config/config-schema";
import { logger } from "~/infrastructure/logger";

type ConfigChangeListener = (config: AppConfig) => void;

export class ConfigServiceImpl {
  private config: AppConfig;
  private readonly configPath: string;
  private listeners: ConfigChangeListener[] = [];

  constructor() {
    this.configPath = path.resolve(process.cwd(), "config.json");
    this.config = defaultAppConfig;
  }

  /**
   * Synchronously loads the configuration from disk.
   * If the file does not exist, it creates it with default values.
   * Applies environment variable overrides.
   */
  load(): void {
    try {
      let fileContent: unknown = {};

      if (fs.existsSync(this.configPath)) {
        try {
          const raw = fs.readFileSync(this.configPath, "utf-8");
          fileContent = JSON.parse(raw);
        } catch (error) {
          logger.fatal(
            { err: error, path: this.configPath },
            "Failed to parse config.json. The file might be corrupted."
          );
          throw new Error(
            `Configuration file at ${this.configPath} is corrupted: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      } else {
        logger.info("config.json not found, creating default");
        // For init, we can write sync.
        fs.writeFileSync(
          this.configPath,
          JSON.stringify(defaultAppConfig, null, 2)
        );
        fileContent = defaultAppConfig;
      }

      // Apply Env Overrides
      const envOverrides = this.getEnvOverrides();
      const mergedConfig = this.deepMerge(fileContent, envOverrides);

      // Validate and Fix
      const result = AppConfigSchema.safeParse(mergedConfig);

      if (result.success) {
        this.config = result.data;
      } else {
        logger.error(
          { errors: result.error.format() },
          "Invalid configuration detected. Using fallback/defaults where possible."
        );
        // If validation fails, we can either throw or try to use what we have?
        // Schema defines defaults, so if we pass partial object, it should fill in.
        // But if we pass wrong types, it fails.
        // Let's try to parse the fileContent + overrides.
        // Ideally we should stop if config is explicitly wrong.
        // But the requirement says "Use Default" or "Stop".
        // I'll throw to be safe if it's completely broken.
        throw new Error(
          `Invalid configuration: ${JSON.stringify(result.error.format())}`
        );
      }

      logger.debug({ config: this.config }, "Configuration loaded");
    } catch (error) {
      logger.fatal({ err: error }, "Failed to load configuration");
      throw error;
    }
  }

  get(): AppConfig {
    return this.config;
  }

  async update(newConfig: Partial<AppConfig>): Promise<AppConfig> {
    // 1. Merge current + new
    // We only allow updating what is passed.
    // Note: This is a shallow merge at top level if we are not careful.
    // We should probably allow deep update or just replace top-level sections.
    // Spec says: "config.jsonをアトミックに書き換える"

    // Let's assume the API passes the full config or a deep partial?
    // Usually API sends JSON which maps to structure.

    // Deep merge for update is safer.
    const merged = this.deepMerge(this.config, newConfig);

    // 2. Validate
    const result = AppConfigSchema.safeParse(merged);
    if (!result.success) {
      throw new Error(
        `Invalid configuration update: ${JSON.stringify(result.error.format())}`
      );
    }

    const validatedConfig = result.data;

    // 3. Save to disk
    await this.saveToDisk(validatedConfig);

    // 4. Update in-memory
    this.config = validatedConfig;

    // 5. Notify listeners
    this.notifyListeners();

    return this.config;
  }

  onChange(listener: ConfigChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notifyListeners() {
    for (const listener of this.listeners) {
      try {
        listener(this.config);
      } catch (error) {
        logger.error({ err: error }, "Error in config listener");
      }
    }
  }

  private async saveToDisk(config: AppConfig): Promise<void> {
    const tempPath = `${this.configPath}.tmp`;
    await fsPromises.writeFile(tempPath, JSON.stringify(config, null, 2));
    await fsPromises.rename(tempPath, this.configPath);
  }

  // biome-ignore lint/complexity/noExcessiveCognitiveComplexity: complex mapping logic
  private getEnvOverrides(): Record<string, unknown> {
    const overrides: Record<string, unknown> = {};
    const prefix = "CONFIG_";

    for (const [envKey, envValue] of Object.entries(process.env)) {
      if (!envKey.startsWith(prefix) || envValue === undefined) {
        continue;
      }

      // biome-ignore lint/suspicious/noExplicitAny: traversing setup
      let currentSchemaNode = defaultAppConfig as any;
      // biome-ignore lint/suspicious/noExplicitAny: overrides construction
      let currentOverrideNode = overrides as any;
      // CONFIG_AI_BASE_URL -> AIBASEURL
      let remainingKey = envKey
        .substring(prefix.length)
        .toUpperCase()
        .replace(/_/g, "");

      while (remainingKey.length > 0) {
        const keys = Object.keys(currentSchemaNode || {});
        // Sort keys by length (descending) to match the longest key first (avoid prefix collisions)
        const sortedKeys = keys.sort((a, b) => b.length - a.length);
        const matchingKey = sortedKeys.find((k) =>
          remainingKey.startsWith(k.toUpperCase())
        );

        if (!matchingKey) {
          break;
        }

        if (remainingKey.length === matchingKey.length) {
          // リーフノードに到達
          try {
            currentOverrideNode[matchingKey] = JSON.parse(envValue);
          } catch {
            currentOverrideNode[matchingKey] = envValue;
          }
          break;
        }

        // 次の階層へ
        remainingKey = remainingKey.substring(matchingKey.length);
        if (!currentOverrideNode[matchingKey]) {
          currentOverrideNode[matchingKey] = {};
        }
        currentOverrideNode = currentOverrideNode[matchingKey];
        currentSchemaNode = currentSchemaNode[matchingKey];
      }
    }
    return overrides;
  }

  // Helper for deep merge
  // biome-ignore lint/suspicious/noExplicitAny: Deep merge requires flexible types
  private deepMerge(target: any, source: any): any {
    if (
      typeof target !== "object" ||
      target === null ||
      typeof source !== "object" ||
      source === null
    ) {
      return source;
    }

    if (Array.isArray(source)) {
      // For arrays, we usually replace logic or concat?
      // Configuration usually expects replacement for arrays (e.g. extension lists).
      return source;
    }

    const output = { ...target };
    for (const key of Object.keys(source)) {
      if (Object.hasOwn(source, key)) {
        if (Object.hasOwn(target, key)) {
          output[key] = this.deepMerge(target[key], source[key]);
        } else {
          output[key] = source[key];
        }
      }
    }
    return output;
  }
}
