import { eq } from "drizzle-orm";
import { db } from "~/infrastructure/db/index";
import { type MediaUrl, mediaUrls } from "~/infrastructure/db/schema";
import { UnknownDbError } from "../errors";

export const insertMediaUrls = async (
  mediaId: string,
  urls: string[]
): Promise<MediaUrl[]> => {
  if (urls.length === 0) {
    return [];
  }
  try {
    const values = urls.map((url) => ({
      mediaId,
      url,
    }));
    const result = await db.insert(mediaUrls).values(values).returning();
    return result;
  } catch (error) {
    throw new UnknownDbError({
      message: "Failed to insert media URLs",
      details: error,
    });
  }
};

export const selectMediaUrlsByMediaId = async (
  mediaId: string
): Promise<MediaUrl[]> => {
  try {
    return await db
      .select()
      .from(mediaUrls)
      .where(eq(mediaUrls.mediaId, mediaId));
  } catch (error) {
    throw new UnknownDbError({
      message: `Failed to select media URLs for mediaId: ${mediaId}`,
      details: error,
    });
  }
};
