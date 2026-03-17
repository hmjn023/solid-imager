import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { loadDatabaseConfig } from "~/config/database";

const TEST_CONFIG_DIR = join(process.cwd(), "temp_test_config");
const CONFIG_FILE_NAME = "db.config.json";
const TEST_CONFIG_PATH = join(TEST_CONFIG_DIR, CONFIG_FILE_NAME);

describe("loadDatabaseConfig", () => {
  beforeEach(() => {
    mkdirSync(TEST_CONFIG_DIR, { recursive: true });
  });

  afterEach(() => {
    rmSync(TEST_CONFIG_DIR, { recursive: true, force: true });
  });

  it("should load pglite configuration correctly", () => {
    const configContent = JSON.stringify({
      databaseType: "pglite",
      pglite: {
        path: "./data/test_pglite",
        inMemory: false,
      },
    });
    writeFileSync(TEST_CONFIG_PATH, configContent);

    const config = loadDatabaseConfig(TEST_CONFIG_DIR);
    expect(config.databaseType).toBe("pglite");
    if (config.databaseType === "pglite") {
      expect(config.pglite).toEqual({
        path: "./data/test_pglite",
        inMemory: false,
      });
    }
  });

  it("should load docker-compose-postgres configuration correctly", () => {
    const configContent = JSON.stringify({
      databaseType: "docker-compose-postgres",
      dockerComposePostgres: {
        host: "localhost",
        port: 5432,
        user: "testuser",
        password: "testpassword",
        database: "testdb",
      },
    });
    writeFileSync(TEST_CONFIG_PATH, configContent);

    const config = loadDatabaseConfig(TEST_CONFIG_DIR);
    expect(config.databaseType).toBe("docker-compose-postgres");
    if (config.databaseType === "docker-compose-postgres") {
      expect(config.dockerComposePostgres).toEqual({
        host: "localhost",
        port: 5432,
        user: "testuser",
        password: "testpassword",
        database: "testdb",
      });
    }
  });

  it("should throw error if config file is not found", () => {
    expect(() => loadDatabaseConfig(TEST_CONFIG_DIR)).toThrow(
      "Database configuration file not found: db.config.json."
    );
  });

  it("should throw error for invalid config format (missing databaseType)", () => {
    const configContent = JSON.stringify({
      pglite: {
        path: "./data/test_pglite",
      },
    });
    writeFileSync(TEST_CONFIG_PATH, configContent);

    expect(() => loadDatabaseConfig(TEST_CONFIG_DIR)).toThrow(
      "Invalid database configuration file format."
    );
  });

  it("should throw error for invalid config format (unsupported databaseType)", () => {
    const configContent = JSON.stringify({
      databaseType: "unsupported",
      pglite: {
        path: "./data/test_pglite",
      },
    });
    writeFileSync(TEST_CONFIG_PATH, configContent);

    expect(() => loadDatabaseConfig(TEST_CONFIG_DIR)).toThrow(
      "Invalid database configuration file format."
    );
  });

  it("should handle pglite inMemory default correctly", () => {
    const configContent = JSON.stringify({
      databaseType: "pglite",
      pglite: {
        path: "./data/test_pglite",
      },
    });
    writeFileSync(TEST_CONFIG_PATH, configContent);

    const config = loadDatabaseConfig(TEST_CONFIG_DIR);
    if (config.databaseType === "pglite") {
      expect(config.pglite.inMemory).toBe(false); // Default value
    }
  });
});
