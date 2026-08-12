import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { createFileRoute } from "@tanstack/solid-router";
import { services } from "~/application/registry";
import { isJobTransferPath } from "~/application/services/job-transfer-storage";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { bootstrapServerRoute } from "~/infrastructure/server-route-bootstrap";
import { nodeStreamToWebReadable } from "~/infrastructure/utils/stream-utils";

export const Route = createFileRoute("/api/jobs/$jobId/artifact")({
	server: {
		handlers: {
			GET: async ({ params }: ServerRouteContext<{ jobId: string }>) => {
				bootstrapServerRoute();
				const job = await services.getJobRepository().findById(params.jobId);
				if (
					job?.status !== "completed" ||
					!job.artifactPath ||
					!job.artifactFileName ||
					!job.artifactContentType ||
					!isJobTransferPath(job.id, job.artifactPath)
				) {
					return new Response("Artifact not found", { status: 404 });
				}

				if (job.artifactExpiresAt && job.artifactExpiresAt <= new Date()) {
					return new Response("Artifact expired", { status: 410 });
				}

				let stat: Awaited<ReturnType<typeof fs.stat>>;
				try {
					stat = await fs.stat(job.artifactPath);
				} catch {
					return new Response("Artifact not found", { status: 404 });
				}

				return new Response(
					nodeStreamToWebReadable(createReadStream(job.artifactPath)),
					{
						headers: {
							"Cache-Control": "private, max-age=3600",
							"Content-Length": String(stat.size),
							"Content-Type": job.artifactContentType,
							"Content-Disposition": `attachment; filename="${encodeURIComponent(job.artifactFileName)}"`,
						},
					},
				);
			},
		},
	},
});
