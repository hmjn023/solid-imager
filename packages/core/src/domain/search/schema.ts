import { z } from "zod";
import { mediaSortSchema } from "./sort";
import { searchGroupSchema } from "./criteria";
import { similarityModelSchema } from "./embedding";

/** Search UI state shared across simple, advanced and similarity search modes. */
export const searchStateSchema = z.object({
	// Modes
	mode: z.enum(["simple", "pro"]),
	activePresetId: z.number().nullable(),

	// Filters (Simple Mode)
	searchQuery: z.string(),
	selectedTags: z.array(z.string()),
	excludeTags: z.array(z.string()),
	tagMode: z.enum(["and", "or"]),
	selectedSource: z.string(),
	selectedProjects: z.array(z.string()),
	selectedIps: z.array(z.string()),
	selectedCharacters: z.array(z.string()),
	selectedAuthors: z.array(z.string()),

	// Filters (Pro Mode)
	advancedCondition: searchGroupSchema.nullable(),

	// Similarity ordering
	similarityAnchorMediaId: z.uuid().nullable(),
	similarityTopK: z.number().int().min(1),
	similarityModel: similarityModelSchema.default("ccip"),
	semanticQuery: z.string().max(2000).default(""),

	// Pagination
	limit: z.number(),
	offset: z.number(),

	// Sorting
	sortBy: mediaSortSchema,
	sortOrder: z.enum(["asc", "desc"]),

	// Scroll Position
	scrollY: z.number(),
});

export type SearchState = z.infer<typeof searchStateSchema>;

/** Default number of similarity candidates considered before pagination. */
export const DEFAULT_SIMILARITY_TOP_K = 1000;

/** Initial search state used before applying saved or session state. */
export const defaultState: SearchState = {
	mode: "simple",
	activePresetId: null,
	searchQuery: "",
	selectedTags: [],
	excludeTags: [],
	tagMode: "and",
	selectedSource: "",
	selectedProjects: [],
	selectedIps: [],
	selectedCharacters: [],
	selectedAuthors: [],
	advancedCondition: null,
	similarityAnchorMediaId: null,
	similarityTopK: DEFAULT_SIMILARITY_TOP_K,
	similarityModel: "ccip",
	semanticQuery: "",
	limit: 20,
	offset: 0,
	sortBy: "date",
	sortOrder: "desc",
	scrollY: 0,
};
