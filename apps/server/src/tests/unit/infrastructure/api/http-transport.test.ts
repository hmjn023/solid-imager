import { getOpenAPIMeta } from "@orpc/openapi";
import { implement, ORPCError, walkProcedureContractsSync } from "@orpc/server";
import { OpenAPIHandler } from "@orpc/openapi/fetch";
import { createClient } from "@solid-imager/client";
import {
	appContract,
	jobsContract,
	mediaContract,
} from "@solid-imager/core/contract";
import { describe, expect, it } from "vitest";

const id = "11111111-1111-4111-8111-111111111111";
const contract = {
	jobs: { downloadArtifact: jobsContract.downloadArtifact },
	media: { upload: mediaContract.upload },
};
const os = implement(contract);
const handler = new OpenAPIHandler(
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
const client = createClient(contract, {
	url: "http://localhost/base",
	fetch: async (url, init) => {
		const { response } = await handler.handle(new Request(url, init), {
			prefix: "/base/api",
		});
		if (!response) throw new Error("HTTP endpoint did not match");
		return response;
	},
});

describe("shared HTTP transport", () => {
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

it("assigns each contract procedure a unique HTTP method and path", () => {
	const routes = new Map<string, string>();
	walkProcedureContractsSync(appContract, (procedure, path) => {
		const operation = path.join(".");
		const metadata = getOpenAPIMeta(procedure);
		expect(metadata?.method, operation).toBeDefined();
		expect(metadata?.path, operation).toBeDefined();
		const route = `${metadata?.method} ${metadata?.path?.replace(/\{[^}]+\}/g, "{}")}`;
		expect(
			routes.get(route),
			`${operation} duplicates ${route}`,
		).toBeUndefined();
		routes.set(route, operation);
	});
});
