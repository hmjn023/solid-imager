import { ORPCError } from "@orpc/server";

export const AI_MAX_BODY_BYTES = 17 * 1024 * 1024;
const inferenceProcedures = new Set([
	"tag",
	"tagOppaiOracle",
	"ccipFeature",
	"ccipDifference",
	"ccipDistances",
	"detectAndCropCharacters",
]);
export function isAiInferenceRequest(url: string): boolean {
	try {
		const pathname = decodeURIComponent(
			new URL(url, "http://localhost").pathname,
		);
		const parts = pathname.split("/").filter(Boolean);
		return (
			parts.length === 4 &&
			parts[0] === "api" &&
			parts[1] === "rpc" &&
			parts[2] === "ai" &&
			inferenceProcedures.has(parts[3])
		);
	} catch {
		return false;
	}
}

/** Bound bodies retained by HTTP parsing and native waiters, before reading any bytes. */
export class AiRequestAdmission {
	private active = 0;
	constructor(private readonly maxActive = 4) {}
	acquire(url: string, contentLength?: string | null): (() => void) | Response {
		if (!isAiInferenceRequest(url)) return () => {};
		if (Number(contentLength) > AI_MAX_BODY_BYTES)
			return this.reject("PAYLOAD_TOO_LARGE");
		if (this.active >= this.maxActive) return this.reject("TOO_MANY_REQUESTS");
		this.active++;
		let released = false;
		return () => {
			if (!released) {
				released = true;
				this.active--;
			}
		};
	}
	private reject(code: "PAYLOAD_TOO_LARGE" | "TOO_MANY_REQUESTS") {
		const error = new ORPCError(code, {
			message:
				code === "PAYLOAD_TOO_LARGE"
					? "AI request exceeds 17 MiB"
					: "AI inference capacity exceeded",
		});
		return Response.json(error.toJSON(), {
			status: error.status,
			headers:
				code === "TOO_MANY_REQUESTS" ? { "retry-after": "5" } : undefined,
		});
	}
}
const host = globalThis as typeof globalThis & {
	__SOLID_IMAGER_AI_ADMISSION__?: AiRequestAdmission;
};
export const aiRequestAdmission = (host.__SOLID_IMAGER_AI_ADMISSION__ ??=
	new AiRequestAdmission());
