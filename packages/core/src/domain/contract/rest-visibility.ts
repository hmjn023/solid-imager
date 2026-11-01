import { defineMeta, type AnyProcedureContract } from "@orpc/contract";

const [setRpcOnly, getRpcOnly] = defineMeta(
	"solid-imager:rpc-only",
	(value: boolean) => value,
);
export const rpcOnly = setRpcOnly(true);
export function isRestProcedure(procedure: AnyProcedureContract) {
	return getRpcOnly(procedure) !== true;
}
