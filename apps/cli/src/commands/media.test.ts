import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  downloadHandler,
  getHandler,
  searchHandler,
  viewHandler,
} from "./media";
import * as orpcClient from "../orpc-client";
import fsPromises from "node:fs/promises";
import fs from "node:fs";
import { finished } from "node:stream/promises";

vi.mock("../orpc-client", () => ({
  getClient: vi.fn(),
}));

vi.mock("node:fs", () => {
  const mockFs = {
    createWriteStream: vi.fn().mockReturnValue({
      on: vi.fn(),
      once: vi.fn(),
      emit: vi.fn(),
      end: vi.fn(),
      write: vi.fn(),
      pipe: vi.fn().mockReturnThis(),
    }),
  };
  return {
    ...mockFs,
    default: mockFs,
  };
});

vi.mock("node:stream/promises", () => ({
  finished: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs/promises", () => ({
  default: {
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
}));

describe("media handlers", () => {
  const mockFetch = vi.fn();
  global.fetch = mockFetch as any;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getHandler", () => {
    it("should fetch media metadata", async () => {
      const mockMedia = { id: "media-1", fileName: "test.jpg" };
      const mockGet = vi.fn().mockResolvedValue(mockMedia);
      const mockRpc = { media: { get: mockGet } };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      const context = {
        args: { id: "media-1" },
        options: { remote: "http://test.local", source: "source-1" },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      };

      const result = await getHandler(context);
      expect(mockGet).toHaveBeenCalledWith({
        sourceId: "source-1",
        mediaId: "media-1",
      });
      expect(context.ok).toHaveBeenCalledWith({ media: mockMedia });
      expect(result).toEqual({ media: mockMedia });
    });

    it("should handle errors", async () => {
      const mockGet = vi.fn().mockRejectedValue(new Error("Fetch failed"));
      const mockRpc = { media: { get: mockGet } };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      const context = {
        args: { id: "media-1" },
        options: { remote: "http://test.local", source: "source-1" },
        ok: vi.fn(),
        error: vi.fn((val) => val),
      };

      const result = await getHandler(context);
      expect(context.error).toHaveBeenCalledWith({
        code: "FETCH_ERROR",
        message: "Fetch failed",
      });
      expect(result).toEqual({ code: "FETCH_ERROR", message: "Fetch failed" });
    });
  });

  describe("searchHandler", () => {
    it("should search media with correct arguments", async () => {
      const mockResult = { total: 1, media: [{ id: "media-1" }] };
      const mockSearch = vi.fn().mockResolvedValue(mockResult);
      const mockRpc = { media: { search: mockSearch } };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      const context = {
        options: {
          remote: "http://test.local",
          query: "test",
          limit: 10,
          offset: 0,
          source: "source-1",
        },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      };

      const result = await searchHandler(context);
      expect(mockSearch).toHaveBeenCalledWith({
        sourceId: "source-1",
        params: {
          limit: 10,
          offset: 0,
          condition: {
            type: "group",
            operator: "and",
            children: [
              {
                type: "criterion",
                target: "keyword",
                operator: "contains",
                value: "test",
              },
            ],
          },
          sort: "date",
          order: "desc",
        },
      });
      expect(context.ok).toHaveBeenCalledWith({
        total: 1,
        items: [{ id: "media-1" }],
      });
      expect(result).toEqual({ total: 1, items: [{ id: "media-1" }] });
    });
  });

  describe("downloadHandler", () => {
    it("should download media and save it with filename", async () => {
      const mockMedia = { id: "media-uuid", fileName: "test.jpg" };
      const mockGet = vi.fn().mockResolvedValue(mockMedia);
      const mockRpc = {
        media: {
          get: mockGet,
        },
      };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      const mockBuffer = Buffer.from("fake-binary-data");
      const headers = new Headers({ "Content-Type": "image/jpeg" });
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer),
        headers,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(mockBuffer);
            controller.close();
          },
        }),
      });

      const context = {
        args: { id: "media-uuid" },
        options: { remote: "http://test.local", source: "source-1" },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      };

      const result: any = await downloadHandler(context);

      expect(orpcClient.getClient).toHaveBeenCalledWith("http://test.local");
      expect(mockGet).toHaveBeenCalledWith({
        sourceId: "source-1",
        mediaId: "media-uuid",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        new URL(
          "/api/sources/source-1/media-uuid",
          "http://test.local"
        ).toString()
      );
      expect(fs.createWriteStream).toHaveBeenCalledWith(
        expect.stringContaining("test.jpg")
      );
      expect(context.ok).toHaveBeenCalledWith(
        expect.objectContaining({
          message: expect.stringContaining("test.jpg"),
        })
      );
      expect(result.message).toContain("test.jpg");
    });

    it("should use id as filename and derive extension if fileName is missing", async () => {
      const mockMedia = { id: "media-uuid" };
      const mockGet = vi.fn().mockResolvedValue(mockMedia);
      const mockRpc = { media: { get: mockGet } };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      const headers = new Headers({ "Content-Type": "image/png" });
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("data")),
        headers,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.from("data"));
            controller.close();
          },
        }),
      });

      const context = {
        args: { id: "media-uuid" },
        options: { remote: "http://test.local", source: "source-1" },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      };

      await downloadHandler(context);
      expect(mockGet).toHaveBeenCalledWith({
        sourceId: "source-1",
        mediaId: "media-uuid",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        new URL(
          "/api/sources/source-1/media-uuid",
          "http://test.local"
        ).toString()
      );
      expect(fs.createWriteStream).toHaveBeenCalledWith(
        expect.stringContaining("media-uuid.png")
      );
    });

    it("should use output option as filename if provided", async () => {
      const mockMedia = { id: "media-uuid", fileName: "test.jpg" };
      const mockGet = vi.fn().mockResolvedValue(mockMedia);
      const mockRpc = { media: { get: mockGet } };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      const headers = new Headers({ "Content-Type": "image/jpeg" });
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("data")),
        headers,
        body: new ReadableStream({
          start(controller) {
            controller.enqueue(Buffer.from("data"));
            controller.close();
          },
        }),
      });

      const context = {
        args: { id: "media-uuid" },
        options: {
          remote: "http://test.local",
          output: "custom.png",
          source: "source-1",
        },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
      };

      await downloadHandler(context);
      expect(mockGet).toHaveBeenCalledWith({
        sourceId: "source-1",
        mediaId: "media-uuid",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        new URL(
          "/api/sources/source-1/media-uuid",
          "http://test.local"
        ).toString()
      );
      expect(fs.createWriteStream).toHaveBeenCalledWith(
        expect.stringContaining("custom.png")
      );
    });

    it("should handle fetch errors", async () => {
      const mockMedia = { id: "media-uuid" };
      const mockGet = vi.fn().mockResolvedValue(mockMedia);
      const mockRpc = { media: { get: mockGet } };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const context = {
        args: { id: "media-uuid" },
        options: { remote: "http://test.local", source: "source-1" },
        ok: vi.fn(),
        error: vi.fn((val) => val),
      };

      const result = await downloadHandler(context);
      expect(mockGet).toHaveBeenCalledWith({
        sourceId: "source-1",
        mediaId: "media-uuid",
      });
      expect(context.error).toHaveBeenCalledWith({
        code: "FETCH_ERROR",
        message: "Failed to fetch media binary: Not Found (404)",
      });
      expect(result).toEqual({
        code: "FETCH_ERROR",
        message: "Failed to fetch media binary: Not Found (404)",
      });
    });
  });

  describe("viewHandler dimensions", () => {
    it("should fail on invalid dimensions", async () => {
      const mockMedia = { id: "media-1" };
      const mockRpc = { media: { get: vi.fn().mockResolvedValue(mockMedia) } };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      const context = {
        args: { id: "media-1" },
        options: {
          remote: "http://test.local",
          source: "source-1",
          width: "50%;inject",
          height: "auto",
        },
        ok: vi.fn(),
        error: vi.fn((val) => val),
      };

      const result = await viewHandler(context);
      expect(context.error).toHaveBeenCalledWith(
        expect.objectContaining({
          code: "VIEW_ERROR",
          message: expect.stringContaining("Invalid dimension"),
        })
      );
    });

    it("should pass on valid dimensions", async () => {
      const mockMedia = { id: "media-1" };
      const mockRpc = { media: { get: vi.fn().mockResolvedValue(mockMedia) } };
      (orpcClient.getClient as any).mockReturnValue(mockRpc as any);

      const headers = new Headers({ "Content-Type": "image/png" });
      mockFetch.mockResolvedValue({
        ok: true,
        arrayBuffer: vi.fn().mockResolvedValue(Buffer.from("data")),
        headers,
      });

      const context = {
        args: { id: "media-1" },
        options: {
          remote: "http://test.local",
          width: "400px",
          height: "10%",
          source: "source-1",
        },
        ok: vi.fn((val) => val),
        error: vi.fn((val) => val),
        agent: false,
      };

      // Mock process.stdout.write
      const stdoutSpy = vi
        .spyOn(process.stdout, "write")
        .mockImplementation(() => true);

      const mockGet = mockRpc.media.get as any;
      await viewHandler(context);
      expect(mockGet).toHaveBeenCalledWith({
        sourceId: "source-1",
        mediaId: "media-1",
      });
      expect(context.ok).toHaveBeenCalledWith({ displayed: true });
      stdoutSpy.mockRestore();
    });
  });
});
