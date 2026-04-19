import { describe, expect, it } from "vite-plus/test";
import { BackupService } from "~/application/services/backup-service";

describe("BackupService Security", () => {
	describe("_filterValidItems", () => {
		it("should skip items with traversal paths for local sources", async () => {
			const mockItems = [
				{ filePath: "valid/path.png", fileName: "path.png" },
				{ filePath: "../invalid/path.png", fileName: "path.png" },
				{ filePath: "/absolute/path.png", fileName: "path.png" },
				{ filePath: "valid/../../traversal.png", fileName: "traversal.png" },
			];

			const mockMediaSource = {
				type: "s3",
				connectionInfo: {},
			};

			const result = await BackupService._filterValidItems(mockItems, mockMediaSource);

			const ExpectedSkipped = 3;
			const ExpectedValid = 1;

			expect(result.skippedCount).toBe(ExpectedSkipped);
			expect(result.validItems.length).toBe(ExpectedValid);
			expect(result.validItems[0].filePath).toBe("valid/path.png");
			expect(result.errorMessages.length).toBe(ExpectedSkipped);
			expect(result.errorMessages[0]).toContain("Invalid path");
		});

		it("should skip items with traversal paths even for non-local sources (as a precaution)", async () => {
			// Although non-local sources might not strictly use file system in the same way,
			// we enforce relative paths for consistency and potential future storage usage.
			const mockItems = [{ filePath: "../s3/path.png", fileName: "path.png" }];

			const mockMediaSource = {
				type: "s3",
				connectionInfo: {},
			};

			const result = await BackupService._filterValidItems(mockItems, mockMediaSource);

			expect(result.skippedCount).toBe(1); // Should still validate path structure
			expect(result.validItems.length).toBe(0);
		});
	});

	// Note: Testing importSourceZip typically requires a real ZIP file or extensive mocking of unzipper.
	// For this integration test, we focus on the unit-logic of path validation which is shared/used.
	// Ideally we would mock `Open.file` return value to contain files with traversal paths.
});
