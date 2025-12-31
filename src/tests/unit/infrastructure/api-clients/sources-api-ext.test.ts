import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSourceDump,
  restoreSource,
} from "~/infrastructure/api-clients/sources-api";

// Mock the orpc client
vi.mock("~/infrastructure/api-clients/orpc-client", () => ({
  orpc: {
    sources: {
      dump: vi.fn(),
      restore: vi.fn(),
    },
  },
  getBaseUrl: vi.fn(() => "/api/rpc"),
}));

import { orpc } from "~/infrastructure/api-clients/orpc-client";

describe("Sources API Client Extensions", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("should call orpc.sources.dump for json mode", async () => {
    const id = "test-source-id";
    const mockDumpData = { defined: true };

    (orpc.sources.dump as any).mockResolvedValue(mockDumpData);

    const result = await fetchSourceDump(id, "json");

    expect(orpc.sources.dump).toHaveBeenCalledWith({ id, mode: "json" });
    // Verify result is a Blob containing the JSON
    expect(result).toBeInstanceOf(Blob);
    const text = await result.text();
    expect(JSON.parse(text)).toEqual(mockDumpData);
  });

  it("should call fetch for zip mode with correct body", async () => {
    const id = "test-source-id";
    const mockBlob = new Blob(["zip content"]);

    (global.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    const result = await fetchSourceDump(id, "zip");

    expect(global.fetch).toHaveBeenCalledWith("/api/rpc/sources/dump", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        json: { id, mode: "zip" },
      }),
    });
    expect(result).toBe(mockBlob);
  });

  it("should call orpc.sources.restore with correct parameters", async () => {
    const id = "test-source-id";
    const data = { items: [] };
    const mockResponse = { processed: 10, skipped: 2 };

    ((orpc.sources as any).restore as any).mockResolvedValue(
      mockResponse as any
    );

    const result = await restoreSource(id, data);

    expect((orpc.sources as any).restore).toHaveBeenCalledWith({
      id,
      data,
    });
    expect(result).toEqual(mockResponse);
  });
});
