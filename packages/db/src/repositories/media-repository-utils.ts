import { UnexpectedError } from "@solid-imager/core/domain/errors";
import {
  and,
  asc,
  count,
  desc,
  eq,
  type InferSelectModel,
  inArray,
  like,
  notInArray,
  or,
  type SQL,
  sql,
  getTableColumns,
} from "drizzle-orm";
import {
  mediaCharacters,
  mediaIps,
  mediaProjects,
  medias,
  mediaTags,
  tags,
} from "../schema";
import type { DrizzleExecutor } from "../types";

function escapeLikeString(str: string): string {
  return str.replace(/[%_]/g, "\\$&");
}

type SearchOptions = {
  query?: string;
  tags?: string[];
  tagMode?: "and" | "or";
  excludeTags?: string[];
  projects?: string[];
  ips?: string[];
  characters?: string[];
  sort?: "date" | "name" | "size";
  order?: "asc" | "desc";
  limit?: number;
  offset?: number;
};

function buildWhereClause(
  mediaSourceId: string | undefined,
  options: SearchOptions,
): SQL | undefined {
  const conditions: (SQL | undefined)[] = [];

  if (mediaSourceId) {
    conditions.push(eq(medias.mediaSourceId, mediaSourceId));
  }

  if (options.query) {
    const escapedQuery = escapeLikeString(options.query);
    conditions.push(
      or(
        like(medias.fileName, `%${escapedQuery}%`),
        like(medias.description, `%${escapedQuery}%`),
      ),
    );
  }

  if (options.tags && options.tags.length > 0) {
    if (options.tagMode === "and") {
      const mediaIdsWithAllTags = sql`(select ${mediaTags.mediaId} from ${mediaTags} inner join ${tags} on ${eq(mediaTags.tagId, tags.id)} where ${inArray(tags.name, options.tags)} group by ${mediaTags.mediaId} having count(distinct ${tags.name}) = ${options.tags.length})`;
      conditions.push(inArray(medias.id, mediaIdsWithAllTags));
    } else {
      const mediaIdsWithAnyTags = sql`(select ${mediaTags.mediaId} from ${mediaTags} inner join ${tags} on ${eq(mediaTags.tagId, tags.id)} where ${inArray(tags.name, options.tags)})`;
      conditions.push(inArray(medias.id, mediaIdsWithAnyTags));
    }
  }

  if (options.excludeTags && options.excludeTags.length > 0) {
    const excludedMediaIds = sql`(select ${mediaTags.mediaId} from ${mediaTags} inner join ${tags} on ${eq(mediaTags.tagId, tags.id)} where ${inArray(tags.name, options.excludeTags)})`;
    conditions.push(notInArray(medias.id, excludedMediaIds));
  }

  if (options.projects && options.projects.length > 0) {
    const projectMediaIds = sql`(select ${mediaProjects.mediaId} from ${mediaProjects} where ${inArray(mediaProjects.projectId, options.projects)})`;
    conditions.push(inArray(medias.id, projectMediaIds));
  }

  if (options.ips && options.ips.length > 0) {
    const ipMediaIds = sql`(select ${mediaIps.mediaId} from ${mediaIps} where ${inArray(mediaIps.ipId, options.ips)})`;
    conditions.push(inArray(medias.id, ipMediaIds));
  }

  if (options.characters && options.characters.length > 0) {
    const characterMediaIds = sql`(select ${mediaCharacters.mediaId} from ${mediaCharacters} where ${inArray(mediaCharacters.characterId, options.characters)})`;
    conditions.push(inArray(medias.id, characterMediaIds));
  }

  const valid = conditions.filter((c): c is SQL => c !== undefined);
  return valid.length > 0 ? and(...valid) : undefined;
}

function buildOrderByClause(
  sort?: "date" | "name" | "size",
  order: "asc" | "desc" = "desc",
): SQL {
  if (sort === "date") {
    return order === "asc" ? asc(medias.createdAt) : desc(medias.createdAt);
  }
  if (sort === "name") {
    return order === "asc" ? asc(medias.fileName) : desc(medias.fileName);
  }
  if (sort === "size") {
    return order === "asc" ? asc(medias.fileSize) : desc(medias.fileSize);
  }
  return desc(medias.createdAt);
}

export function createMediaSearchFunctions(
  getExecutor: (tx?: unknown) => DrizzleExecutor,
) {
  return {
    async searchMedia(
      mediaSourceId: string,
      searchOptions: SearchOptions,
    ) {
      try {
        const executor = getExecutor();
        const whereClause = buildWhereClause(mediaSourceId, searchOptions);
        const orderByClause = buildOrderByClause(
          searchOptions.sort,
          searchOptions.order,
        );

        const query = executor
          .select({
            ...getTableColumns(medias),
            totalCount: sql<number>`count(*) over()`.mapWith(Number),
          })
          .from(medias)
          .where(whereClause)
          .orderBy(orderByClause);

        let pagedQuery: any = query;

        if (searchOptions.limit !== undefined) {
          pagedQuery = pagedQuery
            .limit(searchOptions.limit)
            .offset(searchOptions.offset || 0);
        } else if (searchOptions.offset && searchOptions.offset > 0) {
          pagedQuery = pagedQuery.offset(searchOptions.offset);
        }

        const results = await pagedQuery;

        const mediaList = results.map(
          (r: InferSelectModel<typeof medias> & { totalCount: number }) => {
            const { totalCount, ...mediaData } = r;
            return mediaData;
          },
        );

        let total = results.length > 0 ? results[0].totalCount : 0;

        if (mediaList.length === 0 && (searchOptions.offset || 0) > 0) {
          const countResult = await executor
            .select({ total: count() })
            .from(medias)
            .where(whereClause);
          total = countResult[0]?.total ?? 0;
        }

        return { media: mediaList, total };
      } catch (error) {
        throw new UnexpectedError(
          `Failed to search media for source ID: ${mediaSourceId}`,
          error,
        );
      }
    },

    async searchMediaInDirectory(
      mediaSourceId: string,
      directoryPath: string,
      searchOptions: { query?: string; tags?: string[] },
    ) {
      try {
        const executor = getExecutor();
        const conditions: (SQL | undefined)[] = [
          eq(medias.mediaSourceId, mediaSourceId),
          like(medias.filePath, `${escapeLikeString(directoryPath)}%`),
        ];

        if (searchOptions.query) {
          const escapedQuery = escapeLikeString(searchOptions.query);
          conditions.push(
            or(
              like(medias.fileName, `%${escapedQuery}%`),
              like(medias.description, `%${escapedQuery}%`),
            ),
          );
        }

        if (searchOptions.tags && searchOptions.tags.length > 0) {
          const mediaIdsWithTags = sql`(select ${mediaTags.mediaId} from ${mediaTags} inner join ${tags} on ${eq(mediaTags.tagId, tags.id)} where ${inArray(tags.name, searchOptions.tags)})`;
          conditions.push(inArray(medias.id, mediaIdsWithTags));
        }

        return await executor
          .select()
          .from(medias)
          .where(and(...conditions));
      } catch (error) {
        throw new UnexpectedError(
          `Failed to search media in directory ${directoryPath} for source ID: ${mediaSourceId}`,
          error,
        );
      }
    },

    async globalSearchMedia(
      searchOptions: SearchOptions,
    ) {
      try {
        const executor = getExecutor();
        const whereClause = buildWhereClause(undefined, searchOptions);
        const orderByClause = buildOrderByClause(
          searchOptions.sort,
          searchOptions.order,
        );

        const [{ total }] = await executor
          .select({ total: count() })
          .from(medias)
          .where(whereClause);

        const query = executor
          .select()
          .from(medias)
          .where(whereClause)
          .orderBy(orderByClause);

        let pagedQuery: any = query;

        if (searchOptions.limit !== undefined) {
          pagedQuery = pagedQuery
            .limit(searchOptions.limit)
            .offset(searchOptions.offset || 0);
        } else if (searchOptions.offset && searchOptions.offset > 0) {
          pagedQuery = pagedQuery.offset(searchOptions.offset);
        }

        const mediaList = await pagedQuery;

        return { media: mediaList, total };
      } catch (error) {
        throw new UnexpectedError("Failed to perform global media search", error);
      }
    },
  };
}
