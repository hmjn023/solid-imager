import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { mediaSourceInfoSchema } from "@solid-imager/core/sources";
import { getE2eRuntimeDir } from "./support/fixture";
import { expect, test, waitForAppHydration } from "./support/test";

test("creates and edits a local source through the sidebar and restores it on reload", async ({
	browserHealth,
	page,
	request,
}) => {
	// The save and its sync event can both refresh the list, replacing an in-flight request.
	browserHealth.allowRequestFailure(
		/\/api\/rpc\/sources\/list(?:\?|$)/,
		"net::ERR_ABORTED",
	);
	const directory = await mkdtemp(
		path.join(getE2eRuntimeDir(), "source-form-"),
	);
	const name = `Illustration library ${path.basename(directory)}`;
	const updatedName = `${name} renamed`;
	let sourceId: string | undefined;
	try {
		await page.goto("/search");
		await waitForAppHydration(page);
		await page
			.getByRole("button", { name: "ソースを追加", exact: true })
			.click();
		const add = page.getByRole("dialog", { name: "ソースを追加", exact: true });
		await add.getByRole("textbox", { name: "名前", exact: true }).fill(name);
		await add
			.getByRole("textbox", { name: "ディレクトリパス" })
			.fill(directory);
		const createResponse = page.waitForResponse("**/api/rpc/sources/create");
		await add
			.getByRole("button", { name: "ソースを追加", exact: true })
			.click();
		const created = await createResponse;
		expect(created.ok()).toBe(true);
		const source = mediaSourceInfoSchema.parse((await created.json()).json);
		sourceId = source.id;
		expect(source).toMatchObject({
			name,
			type: "local",
			connectionInfo: { path: directory },
		});
		if (!sourceId) throw new Error("Creating the source did not return its ID");
		await expect(add).toBeHidden();

		const actions = page.getByRole("button", {
			name: `${name}の操作`,
			exact: true,
		});
		await actions.click();
		await page.getByRole("menuitem", { name: "編集", exact: true }).click();
		const edit = page.getByRole("dialog", {
			name: "ソースを編集",
			exact: true,
		});
		const nameInput = edit.getByRole("textbox", { name: "名前", exact: true });
		await expect(nameInput).toHaveValue(name);
		await expect(
			edit.getByRole("textbox", { name: "ディレクトリパス" }),
		).toHaveValue(directory);
		await nameInput.fill(updatedName);
		const updateResponse = page.waitForResponse("**/api/rpc/sources/update");
		await edit.getByRole("button", { name: "変更を保存", exact: true }).click();
		expect((await updateResponse).ok()).toBe(true);
		await expect(edit).toBeHidden();

		const updated = page.getByRole("button", {
			name: `${updatedName}の操作`,
			exact: true,
		});
		await expect(updated).toBeVisible();
		await page.reload();
		await waitForAppHydration(page);
		await expect(updated).toBeVisible();
		await expect(actions).toHaveCount(0);

		const persisted = await request.post("/api/rpc/sources/get", {
			data: { json: { id: sourceId } },
		});
		await expect(persisted).toBeOK();
		expect(
			mediaSourceInfoSchema.parse((await persisted.json()).json),
		).toMatchObject({
			id: sourceId,
			name: updatedName,
			type: "local",
			connectionInfo: { path: directory },
		});
	} finally {
		try {
			if (!sourceId) {
				const list = await request.post("/api/rpc/sources/list", {
					data: { json: null },
				});
				await expect(list).toBeOK();
				const sources = mediaSourceInfoSchema
					.pick({ id: true, name: true })
					.array()
					.parse((await list.json()).json);
				sourceId = sources.find(
					(source) => source.name === name || source.name === updatedName,
				)?.id;
			}
			if (sourceId) {
				const removed = await request.post("/api/rpc/sources/delete", {
					data: { json: { id: sourceId } },
				});
				await expect(removed).toBeOK();
			}
		} finally {
			await rm(directory, { recursive: true, force: true });
		}
	}
});
