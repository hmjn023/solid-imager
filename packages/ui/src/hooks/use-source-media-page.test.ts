import { describe, expect, it } from "vitest";
import { getRestoreImportStrategies } from "./restore-import";

describe("getRestoreImportStrategies", () => {
	it("prefers LanceDB then TAR for tar archives when LanceDB import is available", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.tar", type: "application/x-tar" } as File,
				{ canImportLanceDb: true },
			),
		).toEqual(["lancedb", "tar"]);
	});

	it("falls back to TAR only when LanceDB import is unavailable", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.tar", type: "application/x-tar" } as File,
				{ canImportLanceDb: false },
			),
		).toEqual(["tar"]);
	});

	it("detects ndjson files only when NDJSON import is available", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.ndjson", type: "application/x-ndjson" } as File,
				{ canImportNdjson: true },
			),
		).toEqual(["ndjson"]);
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.ndjson", type: "application/x-ndjson" } as File,
				{ canImportNdjson: false },
			),
		).toEqual(["unsupported"]);
	});

	it("keeps legacy json restore support", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.json", type: "application/json" } as File,
				{},
			),
		).toEqual(["json"]);
	});

	it("marks unknown file types as unsupported", () => {
		expect(
			getRestoreImportStrategies(
				{ name: "source-dump.bin", type: "application/octet-stream" } as File,
				{},
			),
		).toEqual(["unsupported"]);
	});
});
