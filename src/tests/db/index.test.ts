import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { db, pool } from "~/infrastructure/db";
import {
  insertMediaSource,
  selectMediaSourceById,
  selectMediaSources,
  updateMediaSource,
} from "~/infrastructure/db/index";
import type { NewMediaSource } from "~/infrastructure/db/schema";
import { mediaSources } from "~/infrastructure/db/schema";

vi.mock("~/infrastructure/db");
import { resetMockDbState } from "~/infrastructure/db";

describe("Media Source Database Operations", () => {
  beforeAll(async () => {
    // await db.delete(mediaSources);
  });

  afterAll(async () => {
    await pool.end();
  });

  beforeEach(async () => {
    resetMockDbState();
  });

  it("should be a placeholder test", () => {
    expect(true).toBe(true);
  });
});
