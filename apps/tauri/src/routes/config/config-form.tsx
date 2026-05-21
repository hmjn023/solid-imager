import type { AppConfig } from "@solid-imager/core/domain/config/config-schema";
import { ConfigScreen } from "@solid-imager/ui/screens/config-screen";
import { useQueryClient } from "@tanstack/solid-query";
import { orpc } from "~/infrastructure/api-clients/orpc-client";
import { resetThumbnailRuntimeCache } from "~/infrastructure/media/thumbnail-runtime";

export function ConfigForm(props: { data: AppConfig }) {
	const queryClient = useQueryClient();

	return (
		<ConfigScreen
			data={props.data}
			onSubmit={async (value) => {
				await orpc.config.update(value);
				await queryClient.invalidateQueries({ queryKey: ["config"] });
			}}
			onSubmitSuccess={resetThumbnailRuntimeCache}
		/>
	);
}
