import { z } from "zod";

export const statisticsPeriodSchema = z.enum(["recent", "all"]);
export const statisticsSelectionSchema = z.object({
	period: statisticsPeriodSchema.optional(),
	bucket: z.iso.date().optional(),
	ipId: z.uuid().optional(),
	characterId: z.uuid().optional(),
	page: z.int().min(0).max(1_000_000).optional(),
});
export const statisticsRequestSchema = statisticsSelectionSchema.extend({
	timeZone: z
		.string()
		.max(100)
		.refine((zone) => {
			try {
				return (
					!zone.startsWith("+") &&
					!zone.startsWith("-") &&
					Boolean(new Intl.DateTimeFormat("en", { timeZone: zone }))
				);
			} catch {
				return false;
			}
		}, "Expected a time zone name")
		.default("UTC"),
});

const countSchema = z.int().nonnegative();
const rankedEntitySchema = z.object({
	id: z.uuid(),
	name: z.string(),
	count: countSchema,
});
export const STATISTICS_PAGE_SIZE = 20;
export const statisticsResponseSchema = z.object({
	trend: z.array(z.object({ bucket: z.iso.date(), count: countSchema })),
	ips: z.array(rankedEntitySchema),
	characters: z.array(rankedEntitySchema),
	media: z.array(
		z.object({ id: z.uuid(), mediaSourceId: z.uuid(), fileName: z.string() }),
	),
	hasMore: z.boolean(),
});

export type StatisticsSelection = z.infer<typeof statisticsSelectionSchema>;
export type StatisticsRequest = z.infer<typeof statisticsRequestSchema>;
export type LibraryStatistics = z.infer<typeof statisticsResponseSchema>;
