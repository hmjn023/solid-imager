import { defineMeta, type AnyProcedureContract } from "@orpc/contract";

const [setOpenApiVisibility, getOpenApiVisibility] = defineMeta(
	"solid-imager:document-in-openapi",
	(value: boolean) => value,
);
const [setMcpEligibility, getMcpEligibility] = defineMeta(
	"solid-imager:mcp-eligible",
	(value: boolean) => value,
);

export const omitFromOpenApi = setOpenApiVisibility(false);
export const omitFromMcp = setMcpEligibility(false);

export function isDocumentedProcedure(procedure: AnyProcedureContract) {
	return getOpenApiVisibility(procedure) !== false;
}

export function isMcpEligibleProcedure(procedure: AnyProcedureContract) {
	return getMcpEligibility(procedure) !== false;
}
