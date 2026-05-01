import { createPresetClient } from "@solid-imager/ui/preset-client";
import { orpc } from "~/infrastructure/api-clients/orpc-client";

export const PresetClient = createPresetClient(orpc);
