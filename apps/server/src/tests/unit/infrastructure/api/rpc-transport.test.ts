import { implement, ORPCError } from "@orpc/server";
import { RPCHandler } from "@orpc/server/fetch";
import { createClient } from "@solid-imager/client";
import {
	jobsContract,
	mediaContract,
} from "@solid-imager/core/domain/contract";
import { describe, expect, it } from "vitest";

const id = "11111111-1111-4111-8111-111111111111";
const contract = {
	jobs: { downloadArtifact: jobsContract.downloadArtifact },
	media: { upload: mediaContract.upload },
};
const os = implement(contract);
const handler = new RPCHandler(
	os.router({
		jobs: {
			downloadArtifact: os.jobs.downloadArtifact.handler(({ input }) => {
				if (input.id !== id)
					throw new ORPCError("NOT_FOUND", { message: "Artifact not found" });
				return new Blob(["tar"]).stream();
			}),
		},
		media: {
			upload: os.media.upload.handler(async ({ input }) => ({
				success:
					input.file.type === "text/plain" &&
					(await input.file.text()) === "test file",
				filePath: input.file.name,
			})),
		},
	}),
);

// Exercise the actual wire codec without a listener, using a deployment under a path prefix.
const client = createClient<typeof contract>({
	url: "http://localhost/base",
	fetch: async (url, init) => {
		const { response } = await handler.handle(new Request(url, init), {
			prefix: "/base/api/rpc",
		});
		if (!response) throw new Error("RPC endpoint did not match");
		return response;
	},
});

describe("shared RPC transport", () => {
	it("streams a binary artifact and preserves structured errors on the same route", async () => {
		const stream = await client.jobs.downloadArtifact({ id });
		expect(stream).toBeInstanceOf(ReadableStream);
		expect(await new Response(stream).text()).toBe("tar");
		await expect(
			client.jobs.downloadArtifact({
				id: "22222222-2222-4222-8222-222222222222",
			}),
		).rejects.toMatchObject({
			code: "NOT_FOUND",
			message: "Artifact not found",
		});
	});
	it("transports the file contents, media type and filename with an upload", async () => {
		const file = new File(["test file"], "example.txt", { type: "text/plain" });
		await expect(client.media.upload({ sourceId: id, file })).resolves.toEqual({
			success: true,
			filePath: "example.txt",
		});
	});
});
