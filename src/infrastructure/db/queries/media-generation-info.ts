import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { mediaGenerationInfo } from "~/infrastructure/db/schema";
import { NotFoundError, UnknownDbError } from "../errors";

export const selectMediaGenerationInfoById = async (
  mediaId: string
): Promise<typeof mediaGenerationInfo.$inferSelect> => {
  try {
    const result = await db
      .select()
      .from(mediaGenerationInfo)
      .where(eq(mediaGenerationInfo.mediaId, mediaId));
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media generation info for media ID ${mediaId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to select media generation info by media ID: ${mediaId}`,
      details: error,
    });
  }
};

export const updateMediaGenerationInfo = async (
  mediaId: string,
  metadata: object
): Promise<typeof mediaGenerationInfo.$inferSelect> => {
  try {
    const result = await db
      .update(mediaGenerationInfo)
      .set({ metadata })
      .where(eq(mediaGenerationInfo.mediaId, mediaId))
      .returning();
    if (result.length === 0) {
      throw new NotFoundError({
        message: `Media generation info for media ID ${mediaId} not found`,
      });
    }
    return result[0];
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new UnknownDbError({
      message: `Failed to update media generation info for media ID: ${mediaId}`,
      details: error,
    });
  }
};
