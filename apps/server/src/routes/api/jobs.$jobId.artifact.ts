import { createFileRoute } from "@tanstack/solid-router";
import {
	createJobArtifactHeaders,
	resolveJobArtifact,
} from "~/infrastructure/api/job-artifact";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { bootstrapServerRoute } from "~/infrastructure/server-route-bootstrap";

export const Route = createFileRoute("/api/jobs/$jobId/artifact")({
	server: {
		handlers: {
			GET: async ({ params }: ServerRouteContext<{ jobId: string }>) => {
				bootstrapServerRoute();
				const artifact = await resolveJobArtifact(params.jobId);
				if (!artifact) {
					return new Response("Artifact not found", { status: 404 });
				}

				return new Response(artifact.stream, {
					headers: createJobArtifactHeaders(artifact),
				});
			},
		},
	},
});
