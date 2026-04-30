import { buildIpsQueryOptions } from "@solid-imager/ui/query-options/ips-query";
import { fetchAllIps } from "../ips-api";

export const allIpsQueryOptions = () => buildIpsQueryOptions(fetchAllIps);
