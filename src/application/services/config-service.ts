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
          logger.error(
            { err: error },
            "Failed to parse config.json, using defaults"
          );
          // If parse fails, we might want to stop or backup?
          // For now, we proceed with empty (so defaults apply) but log error.
        }
      } else {
        logger.info("config.json not found, creating default");
        this.saveToDisk(defaultAppConfig); // synchronous write? no, saveToDisk is async usually.
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

      logger.info({ config: this.config }, "Configuration loaded");
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
        `Invalid configuration update: ${JSON.stringify(result.error)}`
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

  private getEnvOverrides(): Record<string, unknown> {
    const overrides: Record<string, unknown> = {};
    const prefix = "CONFIG_";

    for (const [key, value] of Object.entries(process.env)) {
      if (key.startsWith(prefix) && value !== undefined) {
        const configPath = key.substring(prefix.length).split("_");
        // Convert path parts to camelCase if needed?
        // Spec says: CONFIG_AI_BASE_URL -> ai.baseUrl
        // So we need to map UPPER_CASE parts to camelCase keys potentially?
        // OR we rely on loose matching?
        // "jobs.concurrency" -> JOBS_CONCURRENCY.
        // "media.tagExtraction" -> MEDIA_TAGEXTRACTION ?
        // Usually env vars are uppercase. We need a strategy to map them to camelCase properties.
        // Strategy: lower case and check if it matches?
        // Or assume the user knows the casing? Env vars usually uppercase.
        // Let's implement a smart mapper:
        // 1. lowercase the part.
        // 2. see if it matches a key in the current node of schema/defaults?
        // Actually, just creating the object structure is enough, but we need correct keys.
        // "JOBS" -> "jobs". "CONCURRENCY" -> "concurrency". "BASE_URL" -> "baseUrl" (problematic).
        // "BASEURL" -> "baseUrl"?

        // "POLLINTERVALMS" -> "pollIntervalMs"

        // This is tricky without a mapping definition.
        // I'll try to match against defaultAppConfig keys case-insensitively.

        this.setDeepValue(overrides, configPath, value);
      }
    }
    return overrides;
  }

  // biome-ignore lint/suspicious/noExplicitAny: Recursively traversing config object needs any
  private setDeepValue(obj: any, pathParts: string[], value: string) {
    let current = obj;
    // We need to match keys against the schema structure to get correct casing.
    // This is a bit complex.
    // Simpler approach: build a normalized tree from env vars, and then map it?

    // Let's look at `defaultAppConfig` structure to resolve keys.
    // biome-ignore lint/suspicious/noExplicitAny: Default config reference
    let schemaRef: any = defaultAppConfig;

    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      const isLast = i === pathParts.length - 1;

      // Find matching key in schemaRef (case-insensitive)
      const keys = Object.keys(schemaRef || {});
      const _exactKey = keys.find(
        (k) =>
          k.toUpperCase() === part.toUpperCase() ||
          k.toUpperCase() === part.replace(/_/g, "").toUpperCase()
      );
      // Try to match "BASE_URL" to "baseUrl". Remove underscores from both sides?
      // "BASE_URL" -> "BASEURL". "baseUrl" -> "BASEURL". Match.

      const matchingKey = keys.find((k) => {
        const kNorm = k.toUpperCase().replace(/_/g, "");
        const pNorm = part.toUpperCase().replace(/_/g, "");
        return kNorm === pNorm;
      });

      if (!matchingKey) {
        // If we can't find a matching key in default config, we skip or add as is?
        // If it's a new key not in defaults (e.g. strict schema might reject it), we might want to skip.
        // But let's assume valid config.
        // If we can't match, we stop to avoid garbage.
        return;
      }

      if (isLast) {
        // Parse value
        // biome-ignore lint/suspicious/noExplicitAny: JSON.parse returns any
        let parsedValue: any = value;
        try {
          parsedValue = JSON.parse(value);
        } catch {
          // keep as string
        }
        current[matchingKey] = parsedValue;
      } else {
        if (!current[matchingKey]) {
          current[matchingKey] = {};
        }
        current = current[matchingKey];
        schemaRef = schemaRef[matchingKey];
      }
    }
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
