import { defineMeta, type AnyProcedureContract } from "@orpc/contract";

const [setRpcOnly, getRpcOnly] = defineMeta(
	"solid-imager:rpc-only",
	(value: boolean) => value,
);
/** Marks a contract procedure as available over RPC but omitted from REST. */
export const rpcOnly = setRpcOnly(true);
/** Returns whether a procedure is exposed through the REST API. */
export function isRestProcedure(procedure: AnyProcedureContract) {
	return getRpcOnly(procedure) !== true;
}
