import { createFileRoute } from "@tanstack/solid-router";
import { services } from "~/application/registry";
import { handleMediaRegionRenderRequest } from "~/infrastructure/api/media-region-render-handler";
import type { ServerRouteContext } from "~/infrastructure/router/route-types";
import { bootstrapServerRoute } from "~/infrastructure/server-route-bootstrap";

export const Route = createFileRoute("/api/media-regions/$regionId/render")({
	server: {
		handlers: {
			GET: async ({
				params,
				request,
			}: ServerRouteContext<{ regionId: string }>) => {
				bootstrapServerRoute();
				return handleMediaRegionRenderRequest(
					request,
					params.regionId,
					services.getMediaRegionService(),
				);
			},
		},
	},
});
