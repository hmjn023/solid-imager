import { randomUUID } from "node:crypto";
import { copyFile, link, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultAppConfig } from "@solid-imager/core/domain/config/config-schema";
import { mediaGenerationInfo, medias, mediaSources } from "@solid-imager/db/schema";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import sharp from "sharp";
import { createPglite } from "../src/infrastructure/db/pglite";
import {
  E2E_PRIMARY_FILE_NAME,
  E2E_PRIMARY_MEDIA_ID,
  E2E_SIMILAR_FILE_NAME,
  E2E_SIMILAR_MEDIA_ID,
  E2E_SOURCE_ID,
  E2E_SOURCE_NAME,
} from "../src/tests/e2e/support/fixture";

const appRoot = path.resolve(import.meta.dir, "..");
// Three pages cover restored scrolling and the next-page fetch while avoiding
// the I/O cost of the oversized fixture used by older runs.
const E2E_PAGINATED_MEDIA_COUNT = 600;

export type IsolatedRuntime = {
  routeTreePath: string;
};

export function assertSafeRuntimeDir(runtimeDir: string, allowedRuntimeRoot: string): void {
  const resolvedRoot = path.resolve(allowedRuntimeRoot);
  const relative = path.relative(resolvedRoot, runtimeDir);
  if (relative === "" || relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Runtime directory must be a child of ${resolvedRoot}, received ${runtimeDir}`);
  }
}

function createImageSvg(accentColor: string, backgroundColor: string): Buffer {
  return Buffer.from(`
		<svg width="256" height="256" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg">
			<rect width="256" height="256" fill="${backgroundColor}" />
			<circle cx="128" cy="128" r="84" fill="${accentColor}" />
			<path d="M48 184 L104 120 L144 160 L184 96 L224 184 Z" fill="#ffffff" fill-opacity="0.85" />
		</svg>
	`);
}

async function linkFixture(sourcePath: string, targetPath: string): Promise<void> {
  try {
    await link(sourcePath, targetPath);
  } catch {
    // Hard links are cheap on the local E2E filesystem. Keep a copy fallback
    // for filesystems that do not support them.
    await copyFile(sourcePath, targetPath);
  }
}

async function seedMediaFixtures(runtimeDir: string): Promise<void> {
  const mediaDir = path.join(runtimeDir, "media");
  const thumbnailDir = path.join(runtimeDir, "thumbnails", E2E_SOURCE_ID);
  const smallThumbnailDir = path.join(thumbnailDir, "256");
  await mkdir(mediaDir, { recursive: true });
  await mkdir(thumbnailDir, { recursive: true });
  await mkdir(smallThumbnailDir, { recursive: true });

  const primaryPath = path.join(mediaDir, E2E_PRIMARY_FILE_NAME);
  const similarPath = path.join(mediaDir, E2E_SIMILAR_FILE_NAME);
  await Promise.all([
    sharp(createImageSvg("#4f46e5", "#e0e7ff")).png().toFile(primaryPath),
    sharp(createImageSvg("#6366f1", "#eef2ff")).png().toFile(similarPath),
  ]);

  await Promise.all([
    sharp(primaryPath)
      .resize({ width: 512, height: 512, fit: "inside" })
      .webp()
      .toFile(path.join(thumbnailDir, `${E2E_PRIMARY_MEDIA_ID}.webp`)),
    sharp(similarPath)
      .resize({ width: 512, height: 512, fit: "inside" })
      .webp()
      .toFile(path.join(thumbnailDir, `${E2E_SIMILAR_MEDIA_ID}.webp`)),
  ]);

  const [primaryStats, similarStats] = await Promise.all([stat(primaryPath), stat(similarPath)]);
  const paginatedMedia = Array.from({ length: E2E_PAGINATED_MEDIA_COUNT }, (_, index) => ({
    id: randomUUID(),
    fileName: `e2e-scroll-${String(index + 1).padStart(4, "0")}.png`,
  }));
  const primaryThumbnailPath = path.join(
    thumbnailDir,
    `${E2E_PRIMARY_MEDIA_ID}.webp`,
  );
  const similarThumbnailPath = path.join(
    thumbnailDir,
    `${E2E_SIMILAR_MEDIA_ID}.webp`,
  );
  await Promise.all(
    [
      linkFixture(
        primaryThumbnailPath,
        path.join(smallThumbnailDir, `${E2E_PRIMARY_MEDIA_ID}.webp`),
      ),
      linkFixture(
        similarThumbnailPath,
        path.join(smallThumbnailDir, `${E2E_SIMILAR_MEDIA_ID}.webp`),
      ),
      ...paginatedMedia.flatMap(({ id, fileName }) => [
        linkFixture(primaryPath, path.join(mediaDir, fileName)),
        linkFixture(primaryThumbnailPath, path.join(thumbnailDir, `${id}.webp`)),
        linkFixture(
          primaryThumbnailPath,
          path.join(smallThumbnailDir, `${id}.webp`),
        ),
      ]),
    ],
  );

  const pgliteDir = path.join(runtimeDir, "pglite");
  const client = createPglite(pgliteDir);
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder: path.join(appRoot, "drizzle") });
    const seededAt = new Date();
    await db.insert(mediaSources).values({
      id: E2E_SOURCE_ID,
      name: E2E_SOURCE_NAME,
      description: "Isolated media source for browser tests",
      type: "local",
      connectionInfo: { path: mediaDir },
      createdAt: seededAt,
      updatedAt: seededAt,
    });
    await db.insert(medias).values([
      {
        id: E2E_PRIMARY_MEDIA_ID,
        mediaSourceId: E2E_SOURCE_ID,
        filePath: E2E_PRIMARY_FILE_NAME,
        fileName: E2E_PRIMARY_FILE_NAME,
        mediaType: "image",
        width: 256,
        height: 256,
        fileSize: primaryStats.size,
        description: "Primary browser fixture media",
        createdAt: primaryStats.birthtime,
        modifiedAt: primaryStats.mtime,
        indexedAt: seededAt,
        status: "active",
      },
      {
        id: E2E_SIMILAR_MEDIA_ID,
        mediaSourceId: E2E_SOURCE_ID,
        filePath: E2E_SIMILAR_FILE_NAME,
        fileName: E2E_SIMILAR_FILE_NAME,
        mediaType: "image",
        width: 256,
        height: 256,
        fileSize: similarStats.size,
        description: "Similarity candidate browser fixture media",
        createdAt: similarStats.birthtime,
        modifiedAt: similarStats.mtime,
        indexedAt: seededAt,
        status: "active",
      },
      ...paginatedMedia.map(({ id, fileName }, index) => {
        const createdAt = new Date(seededAt.getTime() - (index + 2) * 1000);
        return {
          id,
          mediaSourceId: E2E_SOURCE_ID,
          filePath: fileName,
          fileName,
          mediaType: "image" as const,
          width: 256,
          height: 256,
          fileSize: primaryStats.size,
          description: "Paginated browser scroll fixture media",
          createdAt,
          modifiedAt: createdAt,
          indexedAt: seededAt,
          status: "active" as const,
        };
      }),
    ]);
    await db.insert(mediaGenerationInfo).values([
      {
        mediaId: E2E_PRIMARY_MEDIA_ID,
        metadata: { fixture: "e2e-primary" },
      },
      {
        mediaId: E2E_SIMILAR_MEDIA_ID,
        metadata: { fixture: "e2e-similar" },
      },
      ...paginatedMedia.map(({ id }) => ({
        mediaId: id,
        metadata: { fixture: "e2e-scroll" },
      })),
    ]);
  } finally {
    await client.close();
  }
}

async function createRouteTreePlaceholder(runtimeDir: string): Promise<string> {
  const routeTreePath = path.join(runtimeDir, "routeTree.generated.ts");
  await writeFile(routeTreePath, "export const __isolatedRouteTreePlaceholder = true;\n");
  return routeTreePath;
}

export async function prepareIsolatedRuntime(runtimeDir: string): Promise<IsolatedRuntime> {
  await rm(runtimeDir, { recursive: true, force: true });
  await mkdir(runtimeDir, { recursive: true });

  const config = {
    ...defaultAppConfig,
    jobs: {
      ...defaultAppConfig.jobs,
      concurrency: 1,
      aiConcurrency: 1,
      pollIntervalMs: 100,
      enableAutoTagging: false,
      enableAutoCcipExtraction: false,
    },
    storage: {
      ...defaultAppConfig.storage,
      thumbnailDir: path.join(runtimeDir, "thumbnails"),
    },
  };
  await writeFile(path.join(runtimeDir, "config.json"), JSON.stringify(config, null, 2));
  await seedMediaFixtures(runtimeDir);

  return { routeTreePath: await createRouteTreePlaceholder(runtimeDir) };
}
