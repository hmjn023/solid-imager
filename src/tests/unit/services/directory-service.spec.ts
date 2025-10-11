import { describe, expect, it, vi } from "vitest";

// Mock the modules that cause environment variable issues
vi.mock("~/infrastructure/api-clients/sources", () => ({
  getMediaSourceById: vi.fn(),
}));

vi.mock("~/infrastructure/storage/factory", () => ({
  getDriver: vi.fn(),
}));

import { DirectoryService } from "~/application/services/directory-service";
import * as SourceApi from "~/infrastructure/api-clients/sources";
import * as StorageFactory from "~/infrastructure/storage/factory";

describe("DirectoryService", () => {
  it("should list media in subdirectory successfully", async () => {
    const mockSource = {
      id: "1",
      name: "test-source",
      type: "local",
      path: "/tmp",
    };
    const mockMediaList = [{ name: "file1.jpg" }, { name: "file2.png" }];

    (SourceApi.getMediaSourceById as vi.Mock).mockResolvedValue([mockSource]);
    (StorageFactory.getDriver as vi.Mock).mockReturnValue({
      list: vi.fn().mockResolvedValue(mockMediaList),
    });

    const result = await DirectoryService.listMediaInSubdirectory(
      "1",
      "/tmp/subdir"
    );

    expect(SourceApi.getMediaSourceById).toHaveBeenCalledWith("1");
    expect(StorageFactory.getDriver).toHaveBeenCalledWith(mockSource);
    expect(result).toEqual(mockMediaList);
  });

  it("should throw an error if media source is not found", async () => {
    (SourceApi.getMediaSourceById as vi.Mock).mockResolvedValue([]);

    await expect(
      DirectoryService.listMediaInSubdirectory("999", "/tmp/subdir")
    ).rejects.toThrow("Media source not found");
    expect(SourceApi.getMediaSourceById).toHaveBeenCalledWith("999");
  });
});
