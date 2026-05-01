import { createPresetClient } from "@solid-imager/ui/preset-client";
import { orpc } from "../../api-clients/orpc-client";

export const PresetClient = createPresetClient(orpc);
