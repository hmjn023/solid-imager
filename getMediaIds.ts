
import { drizzle } from 'drizzle-orm/pglite';
import { PGlite } from '@electric-sql/pglite';
import * as schema from './src/infrastructure/db/schema';

async function getMediaIds() {
    const pglite = new PGlite('./.data/pglite');
    const db = drizzle(pglite, { schema });

    const media = await db.query.medias.findFirst();
    if (media) {
        console.log(`mediaSourceId: ${media.mediaSourceId}`);
        console.log(`mediaId: ${media.id}`);
    } else {
        console.log("No media found in the database.");
    }
}

getMediaIds();
