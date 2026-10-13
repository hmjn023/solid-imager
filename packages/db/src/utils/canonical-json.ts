import { createHash } from "node:crypto";
function canonical(value: unknown): string {
	if (Array.isArray(value))
		return `[${value.map((entry: unknown) => canonical(entry)).join(",")}]`;
	if (value !== null && typeof value === "object")
		return `{${Object.entries(value)
			.sort(([a], [b]) => (a === b ? 0 : a < b ? -1 : 1))
			.map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
			.join(",")}}`;
	return JSON.stringify(value) ?? "null";
}
/** External JSON boundary: normalize dates/undefined and sort object keys. */
export function canonicalJsonHash(value: object): string {
	const serialized: unknown = JSON.parse(JSON.stringify(value));
	return createHash("sha256").update(canonical(serialized)).digest("hex");
}
