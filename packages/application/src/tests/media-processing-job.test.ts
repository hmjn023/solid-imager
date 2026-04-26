import { describe, expect, it } from "vite-plus/test";
import {
	parseMediaProcessingJobPayload,
	toProcessMediaNewJob,
} from "../services/media-processing-job";

describe("media-processing-job", () => {
	it("parses canonical payloads and filters unknown steps", () => {
		expect(
			parseMediaProcessingJobPayload({
				mediaId: "media-id",
				sourcePath: "/source",
				steps: ["generateThumbnail", "unknown"],
				type: "processMedia",
			}),
		).toEqual({
			mediaId: "media-id",
			sourcePath: "/source",
			steps: ["generateThumbnail"],
			type: "processMedia",
		});
	});

	it("rejects payloads missing required fields", () => {
		expect(parseMediaProcessingJobPayload({ mediaId: "media-id" })).toBeNull();
		expect(parseMediaProcessingJobPayload({ sourcePath: "/source" })).toBeNull();
		expect(parseMediaProcessingJobPayload(null)).toBeNull();
	});

	it("builds canonical processMedia job records", () => {
		expect(
			toProcessMediaNewJob({
				sourceId: "source-id",
				mediaId: "media-id",
				sourcePath: "/source",
				steps: ["queueAutoTagging"],
			}),
		).toEqual({
			type: "processMedia",
			mediaSourceId: "source-id",
			payload: {
				mediaId: "media-id",
				sourcePath: "/source",
				steps: ["queueAutoTagging"],
				type: "processMedia",
			},
		});
	});
});
