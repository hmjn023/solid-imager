import { sql } from "drizzle-orm";

/** Older job writers stored a JSON object as a string inside the JSONB column. */
export function normalizedPayloadExpression(column = sql`payload`) {
	return sql`COALESCE(
		CASE WHEN jsonb_typeof(${column}) = 'string' AND pg_input_is_valid(${column}#>>'{}', 'jsonb')
			THEN (${column}#>>'{}')::jsonb ELSE ${column} END,
		'{}'::jsonb
	)`;
}
