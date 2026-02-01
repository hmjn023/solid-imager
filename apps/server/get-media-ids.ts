import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { medias } from './src/infrastructure/db/schema';

async function getMediaIds() {
    let pglite: PGlite | undefined;
    try {
        pglite = new PGlite('./.data/pglite');
        const db = drizzle(pglite, { schema: { medias } });

        const media = await db.query.medias.findFirst();
        if (media) {
            // biome-ignore lint/suspicious/noConsole: Script utility
            console.log(`mediaSourceId: ${media.mediaSourceId}`);
            // biome-ignore lint/suspicious/noConsole: Script utility
            console.log(`mediaId: ${media.id}`);
        } else {
            // biome-ignore lint/suspicious/noConsole: Script utility
            console.log("No media found in the database.");
        }
    } catch (error) {
        // biome-ignore lint/suspicious/noConsole: Script utility
        console.error("An error occurred:", error);
    } finally {
        await pglite?.close();
    }
}

getMediaIds();
