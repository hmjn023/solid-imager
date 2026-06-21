import { and, asc, eq, notExists } from "drizzle-orm";
import { db } from "../src/infrastructure/db";
import { mediaCharacters, mediaIps, medias, mediaTags } from "../src/infrastructure/db/schema";

async function run() {
  console.log("Starting query debug...");
  try {
    const mediaSourceId = undefined;
    const force = false;

    const whereClause = and(
      eq(medias.mediaType, "image"),
      mediaSourceId ? eq(medias.mediaSourceId, mediaSourceId) : undefined,
      force
        ? undefined
        : and(
            notExists(
              db
                .select({ f: mediaTags.mediaId })
                .from(mediaTags)
                .where(and(eq(mediaTags.mediaId, medias.id), eq(mediaTags.source, "AI"))),
            ),
            notExists(
              db
                .select({ f: mediaCharacters.mediaId })
                .from(mediaCharacters)
                .where(
                  and(eq(mediaCharacters.mediaId, medias.id), eq(mediaCharacters.source, "AI")),
                ),
            ),
            notExists(
              db
                .select({ f: mediaIps.mediaId })
                .from(mediaIps)
                .where(and(eq(mediaIps.mediaId, medias.id), eq(mediaIps.source, "AI"))),
            ),
          ),
    );

    console.log("Constructed where clause. Executing query...");

    const results = await db.query.medias.findMany({
      where: whereClause,
      orderBy: asc(medias.id),
      limit: 10, // Limit to avoid massive output
    });

    console.log(`Query successful. Found ${results.length} items.`);
  } catch (e: any) {
    console.error("Query failed!");
    console.error(e);
  } finally {
    process.exit(0);
  }
}

run();
