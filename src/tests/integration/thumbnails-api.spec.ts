import { expect, test } from "@playwright/test";

// これらのテストには、実行中のサーバーと既存のデータが必要です。
// テストデータベースの実際のIDに置き換えてください。
const SOURCE_ID = "... pre-existing-source-id ...";

test.describe("Thumbnail API", () => {
  test("POST /api/sources/:mediaSourceId/thumbnails should trigger bulk generation", async ({
    request,
  }) => {
    const response = await request.post(`/api/sources/${SOURCE_ID}/thumbnails`);
    const Accepted = 202;
    expect(response.status()).toBe(Accepted); // Accepted
    const data = await response.json();
    expect(data.message).toContain("Thumbnail generation job started");
  });

  test("POST /api/sources/:mediaSourceId/thumbnails should return 404 for non-existent source", async ({
    request,
  }) => {
    const fakeSourceId = "00000000-0000-0000-0000-000000000000";
    const response = await request.post(
      `/api/sources/${fakeSourceId}/thumbnails`
    );
    const NotFound = 404;
    expect(response.status()).toBe(NotFound);
    const data = await response.json();
    expect(data.error).toContain("Source not found");
  });
});
