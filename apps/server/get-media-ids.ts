import { drizzle } from "drizzle-orm/pglite";
import { medias } from "./src/infrastructure/db/schema";
import { createPglite } from "./src/infrastructure/db/pglite";

async function getMediaIds() {
  let pglite: ReturnType<typeof createPglite> | undefined;
  try {
    pglite = createPglite("./.data/pglite");
    const db = drizzle(pglite, { schema: { medias } });

    const media = await db.query.medias.findFirst();
    if (media) {
      console.log(`mediaSourceId: ${media.mediaSourceId}`);
      console.log(`mediaId: ${media.id}`);
    } else {
      console.log("No media found in the database.");
    }
  } catch (error) {
    console.error("An error occurred:", error);
  } finally {
    await pglite?.close();
  }
}

getMediaIds();
