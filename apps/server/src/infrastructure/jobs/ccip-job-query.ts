import { or, sql, type SQL } from "drizzle-orm";
import { jobs } from "~/infrastructure/db/schema";

/** Matches both current one-media child jobs and legacy mediaIds batch jobs. */
export function ccipJobTargetsMedia(mediaId: string): SQL {
	const condition = or(
		sql`${jobs.payload}->>'mediaId' = ${mediaId}`,
		sql`(${jobs.payload}->'mediaIds') ? ${mediaId}`,
	);
	if (!condition) {
		throw new Error("CCIP job target condition could not be constructed");
	}
	return condition;
}
