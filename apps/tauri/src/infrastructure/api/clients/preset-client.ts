import { createPresetClient } from "@solid-imager/ui/preset-client";
import { orpc } from "./orpc-client";

export const PresetClient = createPresetClient(orpc);
