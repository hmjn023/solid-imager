import { createPresetClient } from "@solid-imager/ui/preset-client";
import { PresetManager as SharedPresetManager } from "@solid-imager/ui/preset-manager";
import { PresetClient as rawPresetClient } from "~/infrastructure/api/clients/preset-client";

const presetClient = createPresetClient(rawPresetClient);

export function PresetManager(props: {
	class?: string;
	onAction?: () => void;
}) {
	return (
		<SharedPresetManager
			class={props.class}
			onAction={props.onAction}
			presetClient={presetClient}
		/>
	);
}
