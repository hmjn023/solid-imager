import { expect, test } from "./support/test";

for (const width of [375, 1440]) {
	test.describe(`candidate selection at ${width}px`, () => {
		test.use({ hasTouch: true, viewport: { width, height: 900 } });

		for (const kind of ["Regular", "Virtual"]) {
			test(`${kind} filtered candidates can be tapped`, async ({ page }) => {
				await page.goto(
					`http://127.0.0.1:${process.env.E2E_GALLERY_PORT}/?combobox=1`,
				);
				const input = page.getByRole("combobox", {
					name: `${kind} candidates`,
				});
				const selection = page.getByLabel(`${kind} selection`);
				await input.tap();
				await page
					.getByRole("option", { name: "Candidate 00", exact: true })
					.tap();
				await expect(selection).toHaveText("Candidate 00");

				await page.reload();
				await input.fill("Candidate 7");
				await expect(page.getByRole("option")).toHaveCount(10);
				await page
					.getByRole("option", { name: "Candidate 72", exact: true })
					.tap();
				await expect(selection).toHaveText("Candidate 72");
				await expect(input).toBeFocused();

				await page.reload();
				await input.fill("Candidate 8");
				await expect(page.getByRole("option")).toHaveCount(10);
				await page
					.getByRole("option", { name: "Candidate 83", exact: true })
					.click();
				await expect(selection).toHaveText("Candidate 83");

				await page.reload();
				await input.fill("Candidate 9");
				await expect(
					page.getByRole("option", { name: "Candidate 90", exact: true }),
				).toBeVisible();
				await input.press("ArrowDown");
				await input.press("Enter");
				await expect(selection).toHaveText("Candidate 90");

				await input.fill("Uncommitted query");
				await page.getByRole("button", { name: "Outside control" }).tap();
				await expect(input).toHaveValue("Candidate 90");
			});

			test(`${kind} candidates remain scrollable by touch`, async ({
				page,
				context,
			}) => {
				await page.goto(
					`http://127.0.0.1:${process.env.E2E_GALLERY_PORT}/?combobox=1`,
				);
				const input = page.getByRole("combobox", {
					name: `${kind} candidates`,
				});
				await input.fill("Candidate 7");
				const listbox = page.getByRole("listbox");
				await expect(page.getByRole("option")).toHaveCount(10);
				const start = await listbox.evaluate((element) => {
					let scroller = element;
					while (
						scroller.parentElement &&
						scroller.scrollHeight <= scroller.clientHeight
					) {
						scroller = scroller.parentElement;
					}
					const rect = scroller.getBoundingClientRect();
					return { x: rect.x + rect.width / 2, y: rect.bottom - 30 };
				});
				const session = await context.newCDPSession(page);
				await session.send("Input.dispatchTouchEvent", {
					type: "touchStart",
					touchPoints: [{ ...start, id: 1 }],
				});
				for (let step = 1; step <= 6; step += 1) {
					await session.send("Input.dispatchTouchEvent", {
						type: "touchMove",
						touchPoints: [{ x: start.x, y: start.y - step * 25, id: 1 }],
					});
				}
				await session.send("Input.dispatchTouchEvent", {
					type: "touchEnd",
					touchPoints: [],
				});
				await session.detach();
				await expect
					.poll(() =>
						listbox.evaluate((element) => {
							let scroller: Element | null = element;
							while (scroller) {
								if (scroller.scrollTop > 0) return scroller.scrollTop;
								scroller = scroller.parentElement;
							}
							return 0;
						}),
					)
					.toBeGreaterThan(0);
				await expect(page.getByLabel(`${kind} selection`)).toHaveText("None");
				await expect(input).toHaveValue("Candidate 7");
				await page
					.getByRole("option", { name: "Candidate 78", exact: true })
					.tap();
				await expect(page.getByLabel(`${kind} selection`)).toHaveText(
					"Candidate 78",
				);
			});
		}
	});
}
