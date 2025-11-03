import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { selectJobsBySourceId } from "~/infrastructure/db/queries/jobs";
import { jobs, mediaSources, type NewJob } from "~/infrastructure/db/schema";

describe("jobs queries Integration", () => {
  const sourceId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a18";

  beforeAll(async () => {
    await db.delete(jobs);
    await db.delete(mediaSources);

    await db.insert(mediaSources).values({
      id: sourceId,
      name: "job-test",
      type: "local",
      connectionInfo: { path: "/" },
    });

    const job: NewJob = { sourceId, type: "test-job", status: "pending" };
    await db.insert(jobs).values(job);
  });

  afterAll(async () => {
    await db.delete(jobs);
    await db.delete(mediaSources);
  });

  it("should select jobs by source ID", async () => {
    const result = await selectJobsBySourceId(sourceId);
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBe(1);
    expect(result[0].sourceId).toBe(sourceId);
  });
});
