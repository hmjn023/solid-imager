import { expect, test } from "@playwright/test";

// これらのテストには、実行中のサーバーと既存のデータが必要です。
// テストデータベースの実際のIDに置き換えてください。
const SOURCE_ID = "... pre-existing-source-id ...";
const MEDIA_ID = "... pre-existing-media-id ...";
const DIRECTORY_PATH = "... pre-existing-directory ...";

test.describe("Media API", () => {
  test("GET /api/sources/:mediaSourceId/directories/[...directories] should list media", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/sources/${SOURCE_ID}/directories/${DIRECTORY_PATH}`
    );
    expect(response.ok()).toBeTruthy();
    const mediaList = await response.json();
    expect(Array.isArray(mediaList)).toBeTruthy();
  });

  test("GET /api/sources/:mediaSourceId/media/:mediaId should get a media item", async ({
    request,
  }) => {
    const response = await request.get(
      `/api/sources/${SOURCE_ID}/media/${MEDIA_ID}`
    );
    expect(response.ok()).toBeTruthy();
    const media = await response.json();
    expect(media.id).toBe(MEDIA_ID);
  });

  test("PUT /api/sources/:mediaSourceId/media/:mediaId should update a media item", async ({
    request,
  }) => {
    const newDescription = `Updated at ${new Date().toISOString()}`;
    const response = await request.put(
      `/api/sources/${SOURCE_ID}/media/${MEDIA_ID}`,
      {
        data: { description: newDescription },
      }
    );
    expect(response.ok()).toBeTruthy();
    const updatedMedia = await response.json();
    expect(updatedMedia.description).toBe(newDescription);
  });

  // 注: DELETEテストは通常、新しいアイテムを作成してから削除します。
  // これは、ベースとなるテストデータを永続的に変更するのを避けるためです。
  test("DELETE /api/sources/:mediaSourceId/media/:mediaId should delete a media item", async ({
    request,
  }) => {
    // このテストは、サンプルメディアアイテムの削除を避けるためにスキップされています。
    const response = await request.delete(
      `/api/sources/${SOURCE_ID}/media/${MEDIA_ID}`
    );
    expect(response.ok()).toBeTruthy();

    // 削除されたことを確認します。
    const getResponse = await request.get(
      `/api/sources/${SOURCE_ID}/media/${MEDIA_ID}`
    );
    const NotFound = 404;
    expect(getResponse.status()).toBe(NotFound);
  });
});
