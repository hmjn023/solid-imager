import { taggingService } from "~/application/services/tagging-service";
import {
  insertCharacter,
  insertMediaCharacter,
  selectCharacters,
} from "~/infrastructure/db/queries/characters";
import {
  insertIp,
  insertMediaIp,
  selectIps,
} from "~/infrastructure/db/queries/ips";
import { selectMediaBySourceId } from "~/infrastructure/db/queries/media";
import { selectMediaSourceById } from "~/infrastructure/db/queries/media-sources";
import { insertMediaTags } from "~/infrastructure/db/queries/tags";
import { addJobsToQueue, type Job, startJobQueue } from "./job-manager";
import { processMediaJob } from "./thumbnails";

const AI_SOURCE_NAME = "ai-tagger";

async function ensureCharacter(name: string) {
  try {
    const characters = await selectCharacters();
    const existing = characters.find((c) => c.name === name);
    if (existing) {
      return existing;
    }

    const [newChar] = await insertCharacter({
      name,
      source: AI_SOURCE_NAME,
    });
    return newChar;
  } catch (error) {
    // If concurrent insert happened, try finding again
    const characters = await selectCharacters();
    const existing = characters.find((c) => c.name === name);
    if (existing) {
      return existing;
    }
    throw error;
  }
}

async function ensureIp(name: string) {
  try {
    const ips = await selectIps();
    const existing = ips.find((i) => i.name === name);
    if (existing) {
      return existing;
    }

    const [newIp] = await insertIp({
      name,
      source: AI_SOURCE_NAME,
    });
    return newIp;
  } catch (error) {
    const ips = await selectIps();
    const existing = ips.find((i) => i.name === name);
    if (existing) {
      return existing;
    }
    throw error;
  }
}

export async function runAiTagging(job: Job, mediaSourceId: string) {
  // Check if AI service is available
  const available = await taggingService.isServiceAvailable();
  if (!available) {
    throw new Error("AI Service is not available");
  }

  // Get Tags from AI
  const response = await taggingService.getTagsForMedia(
    mediaSourceId,
    job.mediaId
  );

  // 1. Process General Tags
  const generalTags: {
    name: string;
    type: "positive" | "negative";
    confidence: number;
  }[] = [];
  for (const [name, confidence] of Object.entries(response.general)) {
    // Threshold check? Python service might already filter.
    // Assuming all returned are valid.
    generalTags.push({
      name,
      type: "positive", // AI tags are usually content tags (positive)
      confidence,
    });
  }

  if (generalTags.length > 0) {
    await insertMediaTags(job.mediaId, generalTags, AI_SOURCE_NAME);
  }

  // 2. Process Characters
  for (const [name, confidence] of Object.entries(response.character)) {
    try {
      const char = await ensureCharacter(name);
      await insertMediaCharacter(
        job.mediaId,
        char.id,
        AI_SOURCE_NAME,
        confidence
      );
    } catch (error) {
      console.error(`Failed to process character ${name} for media ${job.mediaId}`, error);
    }
  }

  // 3. Process IPs
  for (const name of response.ips) {
    try {
      const ip = await ensureIp(name);
      await insertMediaIp(job.mediaId, ip.id, AI_SOURCE_NAME);
    } catch (error) {
       console.error(`Failed to process IP ${name} for media ${job.mediaId}`, error);
    }
  }
}

export async function queueAiTaggingForSource(mediaSourceId: string) {
  const source = await selectMediaSourceById(mediaSourceId);
  if (!source) {
    throw new Error("Source not found");
  }

  // Assuming local source for path access, but tagging service handles non-local too via buffer
  // However, Job object expects sourcePath.
  let sourcePath = "";
  if (source.type === "local") {
    sourcePath = (source.connectionInfo as { path: string }).path;
  }

  const mediaItems = await selectMediaBySourceId(mediaSourceId);

  const jobs: Job[] = mediaItems.map((media) => ({
    mediaId: media.id,
    sourcePath, // Can be empty if not local, TaggingService handles it
    type: "aiTagging",
  }));

  if (jobs.length > 0) {
    addJobsToQueue(mediaSourceId, jobs);
    startJobQueue(mediaSourceId, (job) => processMediaJob(job, mediaSourceId));
  }

  return jobs.length;
}
