import { describe, expect, it } from "vite-plus/test";
import {
	getPendingImportPrimaryAuthor,
	getPreferredImportSourceId,
	isImportInboxEvent,
} from "./import-inbox-helpers";

describe("import inbox helpers", () => {
	it("prefers the source named default", () => {
		expect(
			getPreferredImportSourceId([
				{
					id: "source-1",
					name: "Archive",
					description: null,
					type: "local",
					connectionInfo: { path: "/archive" },
				},
				{
					id: "source-2",
					name: "Default",
					description: null,
					type: "local",
					connectionInfo: { path: "/default" },
				},
			]),
		).toBe("source-2");
	});

	it("returns the primary author label", () => {
		expect(
			getPendingImportPrimaryAuthor({
				targetUrl: "https://example.com/image.png",
				authors: [{ name: "author-1" }],
			}),
		).toBe("author-1");
		expect(
			getPendingImportPrimaryAuthor({
				targetUrl: "https://example.com/image.png",
			}),
		).toBe("?");
	});

	it("matches supported inbox events", () => {
		expect(isImportInboxEvent("import-request:created")).toBe(true);
		expect(isImportInboxEvent("import-request:processed")).toBe(true);
		expect(isImportInboxEvent("import-request:deleted")).toBe(true);
		expect(isImportInboxEvent("connected")).toBe(false);
	});
});
