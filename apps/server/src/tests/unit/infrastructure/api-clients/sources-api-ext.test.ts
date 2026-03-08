import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  fetchSourceDump,
  importSourceZip,
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
    global.fetch = vi.fn() as any;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.clearAllMocks();
  });

  it("should call direct endpoint for json mode", async () => {
    const id = "test-source-id";
    const mockDumpData = { defined: true };
    const mockBlob = new Blob([JSON.stringify(mockDumpData)], {
      type: "application/json",
    });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    const result = await fetchSourceDump(id, "json");

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/sources/${id}/dump?mode=json`,
      {
        method: "GET",
      }
    );
    expect(result).toBe(mockBlob);
  });

  it("should call direct endpoint for zip mode", async () => {
    const id = "test-source-id";
    const mockBlob = new Blob(["zip content"], { type: "application/zip" });

    (global.fetch as any).mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(mockBlob),
    });

    const result = await fetchSourceDump(id, "zip");

    expect(global.fetch).toHaveBeenCalledWith(
      `/api/sources/${id}/dump?mode=zip`,
      {
        method: "GET",
      }
    );
    expect(result).toBe(mockBlob);
  });

  it("should call import endpoint with binary body", async () => {
    const id = "test-source-id";
    const mockFile = new File(["zip content"], "test.zip", {
      type: "application/zip",
    });
    const mockResponse = { success: true };

    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await importSourceZip(id, mockFile);

    expect(global.fetch).toHaveBeenCalledWith(`/api/sources/${id}/import`, {
      method: "POST",
      headers: {
        "Content-Type": "application/zip",
      },
      body: mockFile,
    });
    expect(result).toEqual(mockResponse);
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
