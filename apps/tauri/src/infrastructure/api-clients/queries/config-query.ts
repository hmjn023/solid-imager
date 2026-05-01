import { buildConfigQueryOptions } from "@solid-imager/ui/query-options/config-query";
import { orpc } from "../orpc-client";

export const configQueryOptions = () => buildConfigQueryOptions(() => orpc.config.get());
