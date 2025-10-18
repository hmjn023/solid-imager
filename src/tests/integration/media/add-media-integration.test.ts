import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ZodError } from "zod";
// import { addMedia } from "../../infrastructure/api-clients/media";
// import { db } from "../../infrastructure/db/index";
// import { medias } from "../../infrastructure/db/schema";
import { cn } from "../../presentation/utils/cn";

describe("Add Media Integration", () => {
  it("should resolve cn module", () => {
    expect(cn).toBeDefined();
  });
});

