import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextcloudDriver } from "~/infrastructure/storage/nextcloud";

// Mock webdav client
const mockGetDirectoryContents = vi.fn();
const mockGetFileContents = vi.fn();
const mockPutFileContents = vi.fn();
const mockCreateDirectory = vi.fn();
const mockDeleteFile = vi.fn();
const mockMoveFile = vi.fn();

vi.mock("webdav", () => ({
  createClient: vi.fn(() => ({
    getDirectoryContents: mockGetDirectoryContents,
    getFileContents: mockGetFileContents,
    putFileContents: mockPutFileContents,
    createDirectory: mockCreateDirectory,
    deleteFile: mockDeleteFile,
    moveFile: mockMoveFile,
  })),
}));

describe("NextcloudDriver", () => {
  let driver: NextcloudDriver;
  const connectionInfo = {
    url: "https://example.com/remote.php/dav/files/user/",
    username: "user",
    password: "password",
  };

  beforeEach(() => {
    driver = new NextcloudDriver(connectionInfo);
    vi.clearAllMocks();
  });

  describe("testConnection", () => {
    it("should return success when connection is valid", async () => {
      mockGetDirectoryContents.mockResolvedValue([]);
      const result = await driver.testConnection();
      expect(result).toEqual({ success: true, message: "Connection successful" });
      expect(mockGetDirectoryContents).toHaveBeenCalledWith("/");
    });

    it("should return failure when connection fails", async () => {
      mockGetDirectoryContents.mockRejectedValue(new Error("Auth failed"));
      const result = await driver.testConnection();
      expect(result).toEqual({
        success: false,
        message: "Auth failed",
      });
    });
  });

  describe("list", () => {
    it("should return list of files and directories", async () => {
      mockGetDirectoryContents.mockResolvedValue([
        {
          filename: "/folder",
          type: "directory",
          size: 0,
          lastmod: "2023-01-01T00:00:00Z",
        },
        {
          filename: "/file.jpg",
          type: "file",
          size: 1024,
          lastmod: "2023-01-02T00:00:00Z",
        },
      ]);

      const result = await driver.list("/");
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        path: "/folder",
        isDirectory: true,
        size: 0,
        lastModified: new Date("2023-01-01T00:00:00Z"),
      });
      expect(result[1]).toEqual({
        path: "/file.jpg",
        isDirectory: false,
        size: 1024,
        lastModified: new Date("2023-01-02T00:00:00Z"),
      });
    });

    it("should return empty array if result is not array (single file)", async () => {
        // Mocking behavior where it might return single object
        mockGetDirectoryContents.mockResolvedValue({ filename: "foo" });
        const result = await driver.list("foo");
        expect(result).toEqual([]);
    });
  });

  describe("get", () => {
    it("should return buffer content", async () => {
      const buffer = Buffer.from("test content");
      mockGetFileContents.mockResolvedValue(buffer);

      const result = await driver.get("test.txt");
      expect(result).toEqual(buffer);
      expect(mockGetFileContents).toHaveBeenCalledWith("/test.txt");
    });

    it("should convert string content to buffer", async () => {
      const content = "test content";
      mockGetFileContents.mockResolvedValue(content);

      const result = await driver.get("test.txt");
      expect(result).toBeInstanceOf(Buffer);
      expect(result.toString()).toBe(content);
    });
  });
});
