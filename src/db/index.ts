"use server";

import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import type { MediaSource, NewMediaSource } from "~/db/schema";

const dbHost = process.env.DB_HOST;
if (!dbHost) {
  throw new Error("DB_HOST is not defined in environment variables.");
}

const dbPort = process.env.DB_PORT;
if (!dbPort) {
  throw new Error("DB_PORT is not defined in environment variables.");
}

const dbUser = process.env.DB_USER;
if (!dbUser) {
  throw new Error("DB_USER is not defined in environment variables.");
}

const dbPassword = process.env.DB_PASSWORD;
if (!dbPassword) {
  throw new Error("DB_PASSWORD is not defined in environment variables.");
}

const dbDatabase = process.env.DB_DATABASE;
if (!dbDatabase) {
  throw new Error("DB_DATABASE is not defined in environment variables.");
}

export const pool = new Pool({
  host: dbHost,
  port: Number.parseInt(dbPort, 10),
  user: dbUser,
  password: dbPassword,
  database: dbDatabase,
});

import {
  categories,
  characters,
  collectionMedia,
  collections,
  ips,
  media,
  mediaCharacters,
  mediaDetails,
  mediaGenerationInfo,
  mediaOrganization,
  mediaSources,
  mediaSync,
  mediaTags,
  mediaTechnicalInfo,
  projects,
  similarMedia,
  tags,
  users,
  viewHistory,
} from "~/db/schema";

export const db = drizzle(pool, {
  schema: {
    mediaSources,
    media,
    tags,
    mediaTags,
    mediaDetails,
    mediaGenerationInfo,
    categories,
    projects,
    ips,
    characters,
    mediaCharacters,
    mediaOrganization,
    mediaTechnicalInfo,
    mediaSync,
    viewHistory,
    similarMedia,
    users,
    collections,
    collectionMedia,
  },
});

export const selectMediaSources = () => db.select().from(mediaSources);

export const selectMediaSourceById = (mediaSourceId: string) =>
  db.select().from(mediaSources).where(eq(mediaSources.id, mediaSourceId));

export const insertMediaSource = (mediaSource: NewMediaSource) =>
  db.insert(mediaSources).values(mediaSource).returning();

export const updateMediaSource = (
  mediaSourceId: string,
  mediaSource: MediaSource
) =>
  db
    .update(mediaSources)
    .set(mediaSource)
    .where(eq(mediaSources.id, mediaSourceId))
    .returning();

export const deleteMediaSource = (mediaSourceId: string) =>
  db.delete(mediaSources).where(eq(mediaSources.id, mediaSourceId)).returning();
