import { describe, expect, it, vi } from "vitest";
import type { DatabaseConfig } from "~/config/database";
import {
  closeConnection,
  createConnection,
} from "~/infrastructure/db/connection";

// Mock PGlite and postgres

vi.mock("@electric-sql/pglite", () => {
  const mockPgliteInstance = {
    waitReady: Promise.resolve(),
    close: vi.fn(() => Promise.resolve()),
    query: vi.fn(() => Promise.resolve()),
    constructor: { name: "PgLite" }, // Add constructor property
  };
  const PgLiteMock = vi.fn(() => mockPgliteInstance);
  // Make the mock instance appear as an instance of PgLiteMock
  Object.setPrototypeOf(mockPgliteInstance, PgLiteMock.prototype);
  // biome-ignore lint/style/useNamingConvention: PGlite is a specific library name and should not be changed.
  return { PGlite: PgLiteMock };
});

vi.mock("postgres", () => {
  const mockPostgresQuery = vi.fn(() => Promise.resolve());
  const mockPostgresInstance = vi.fn((strings, ..._values) => {
    // Simulate the behavior of postgres template literal tag function
    // In this case, we expect a single string 'SELECT 1'
    if (strings && strings.length > 0) {
      return mockPostgresQuery(strings[0]);
    }
    return mockPostgresQuery();
  });
  Object.assign(mockPostgresInstance, {
    end: vi.fn(() => Promise.resolve()),
    query: mockPostgresQuery,
  });
  return {
    default: vi.fn(() => {
      mockPostgresQuery.mockClear();
      mockPostgresInstance.end.mockClear();
      return mockPostgresInstance as any;
    }),
  };
});

describe("createConnection", () => {
  it("should create a PGlite connection when databaseType is pglite", async () => {
    const config: DatabaseConfig = {
      databaseType: "pglite",
      pglite: {
        path: "./data/test_pglite",
        inMemory: false,
      },
    };

    const connection = await createConnection(config);

    expect(connection.constructor.name).toBe("PgLite");
    // Ensure PgLite constructor was called
    const { PGlite } = await import("@electric-sql/pglite");
    expect(PGlite).toHaveBeenCalledWith(config.pglite.path);
  });

  it("should create a postgres connection when databaseType is docker-compose-postgres", async () => {
    const config: DatabaseConfig = {
      databaseType: "docker-compose-postgres",
      dockerComposePostgres: {
        host: "localhost",
        port: 5432,
        user: "testuser",
        password: "testpassword",
        database: "testdb",
      },
    };

    const connection = await createConnection(config);

    // Expect the mocked postgres function to have been called
    const { default: postgres } = await import("postgres");
    expect(postgres).toHaveBeenCalledWith({
      host: "localhost",
      port: 5432,
      username: "testuser",
      password: "testpassword",
      database: "testdb",
    });
    // Check if SELECT 1 was executed by checking the query method on the returned connection
    expect((connection as any).query).toHaveBeenCalledWith("SELECT 1");
  });

  it("should throw an error for unsupported database type", async () => {
    const config: DatabaseConfig = {
      databaseType: "unsupported" as any, // Simulate unsupported type
      // @ts-expect-error
      pglite: {},
    };

    await expect(createConnection(config)).rejects.toThrow(
      "Unsupported database type."
    );
  });
});

describe("closeConnection", () => {
  it("should close PgLite connection", async () => {
    const config: DatabaseConfig = {
      databaseType: "pglite",
      pglite: { path: "./data/test_pglite" },
    };
    const connection = await createConnection(config);
    await closeConnection(connection);
    expect((connection as any).close).toHaveBeenCalled();
  });

  it("should close postgres connection", async () => {
    const config: DatabaseConfig = {
      databaseType: "docker-compose-postgres",
      dockerComposePostgres: {
        host: "localhost",
        port: 5432,
        user: "testuser",
        password: "testpassword",
        database: "testdb",
      },
    };
    const connection = await createConnection(config);
    await closeConnection(connection);
    expect((connection as any).end).toHaveBeenCalled();
  });
});
