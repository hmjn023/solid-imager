import { z } from "zod";

// Search schemas
/** Operators supported by a search criterion. */
export const filterOperatorSchema = z.enum([
	"equals", // 完全一致
	"contains", // 部分一致 (LIKE %val%)
	"startsWith", // 前方一致 (LIKE val%)
	"endsWith", // 後方一致 (LIKE %val)
	"gt", // Greater than (>)
	"gte", // Greater than or equal (>=)
	"lt", // Less than (<)
	"lte", // Less than or equal (<=)
	"in", // 配列に含まれる (IN)
	"notIn", // 配列に含まれない (NOT IN)
	"isEmpty", // 空またはNULL
	"isNotEmpty", // 空でない
]);

/** Media fields and related entities addressable by search criteria. */
export const filterTargetSchema = z.enum([
	"keyword", // 全文検索 (ファイル名, パス, 説明, プロンプト等)
	"fileName",
	"filePath",
	"description",
	"mediaType",
	"width",
	"height",
	"fileSize",
	"createdAt",
	"rating",
	"favorite",
	"viewCount",
	"aiGenerated",
	// 関連テーブル
	"tag", // タグ名またはID
	"author", // 作者名またはID
	"project", // プロジェクト名またはID
	"ip", // IP名またはID
	"character", // キャラクター名またはID
	"folder", // ディレクトリパス (前方一致など)
]);

// 単一の検索条件ノード
// 注意: operator と value の整合性はアプリケーション層で検証する
// 例: isEmpty/isNotEmpty の場合は value を無視、in/notIn の場合は配列を期待
/**
 * A single search predicate. The operator defaults to `equals` and negate to
 * false. Operator/value compatibility is checked by the application layer:
 * empty checks ignore the value, while `in` and `notIn` expect an array.
 */
export const searchCriterionSchema = z.object({
	type: z.literal("criterion"),
	target: filterTargetSchema,
	operator: filterOperatorSchema.default("equals"),
	value: z
		.union([
			z.string(),
			z.number(),
			z.boolean(),
			z.array(z.string()),
			z.array(z.number()),
		])
		.nullable(),
	negate: z.boolean().default(false).optional(), // NOT条件
});

export type SearchCriterion = z.infer<typeof searchCriterionSchema>;

// 条件グループノード (AND/OR)
/** Recursive AND/OR search expression; negate inverts the group when set. */
export type SearchGroup = {
	type: "group";
	operator: "and" | "or";
	children: (SearchGroup | z.infer<typeof searchCriterionSchema>)[];
	negate?: boolean;
};

/** Validates recursive search expressions. Empty groups are treated as having no condition. */
export const searchGroupSchema: z.ZodType<SearchGroup> = z.lazy(() =>
	z.object({
		type: z.literal("group"),
		operator: z.enum(["and", "or"]),
		// children が空の場合、このグループは条件なしとして扱われる（無視される）
		children: z.array(z.union([searchGroupSchema, searchCriterionSchema])),
		negate: z.boolean().default(false).optional(),
	}),
);
