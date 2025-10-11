import { expect, test } from "@playwright/test";

test.describe("/api/config", () => {
	test("GET should return the default configuration", async ({ request }) => {
		const response = await request.get("/api/config");
		expect(response.ok()).toBeTruthy();
		const config = await response.json();
		expect(config.media.image.thumbnail.size.width).toBe(512);
	});

	test("PUT should be handled (mock update)", async ({ request }) => {
		const newConfig = {
			media: { image: { thumbnail: { size: { width: 256, height: 256 } } } },
		};
		const response = await request.put("/api/config", {
			data: newConfig,
		});
		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		// このテストはエンドポイントが機能することを確認するだけであり、実際のファイル保存はまだ実装されていません。
		expect(data.config.media.image.thumbnail.size.width).toBe(256);
	});

	test("POST should be handled (mock reset)", async ({ request }) => {
		const response = await request.post("/api/config");
		expect(response.ok()).toBeTruthy();
		const data = await response.json();
		expect(data.message).toContain("reset to default");
	});
});
