import { describe, expect, it, vi } from "vitest";
import type { Author } from "@solid-imager/core/authors";
import type { IAuthorService } from "../ports/author-service";
import { createAuthorAccountVerificationService } from "./author-account-verification-service";

const profile = {
	remoteId: "1234567",
	username: "creator",
	displayName: "Creator",
};
const author: Author = {
	id: "12345678-1234-4123-8123-123456789abc",
	name: "Managed creator",
	accountId: null,
	accounts: [],
	createdAt: new Date("2026-11-01"),
	updatedAt: new Date("2026-11-01"),
};

async function setup() {
	let now = new Date("2026-11-10T00:00:00Z");
	const confirmAccount = vi
		.fn<IAuthorService["confirmAccount"]>()
		.mockResolvedValue(author);
	const port: IAuthorService = {
		confirmAccount,
		getAuthor: vi.fn().mockResolvedValue(author),
		getAllAuthors: vi.fn(),
		listMedia: vi.fn(),
		correctMedia: vi.fn(),
		merge: vi.fn(),
		createAuthor: vi.fn(),
		updateAuthor: vi.fn(),
		deleteAuthor: vi.fn(),
	};
	const service = createAuthorAccountVerificationService(
		port,
		undefined,
		() => now,
	);
	const { verificationId } = await service.begin({
		authorId: author.id,
		accountId: null,
		username: profile.username,
	});
	return {
		service,
		verificationId,
		confirmAccount,
		advance: () => {
			now = new Date(now.getTime() + 600_000);
		},
	};
}

describe("accepted author identity evidence", () => {
	it.each([
		{ ...profile, username: "other" },
		{ ...profile, remoteId: "999" },
		{ ...profile, displayName: "Other" },
	])(
		"retains accepted evidence after a conflicting observation: %o",
		async (conflict) => {
			const { service, verificationId, confirmAccount } = await setup();
			service.submit(verificationId, profile);
			expect(() => service.submit(verificationId, conflict)).toThrow(
				"取得結果が変化",
			);
			expect(service.submit(verificationId, { ...profile })).toMatchObject({
				profile,
				error: null,
				confirmed: false,
			});
			await service.confirm(verificationId);
			expect(confirmAccount).toHaveBeenCalledExactlyOnceWith(
				expect.objectContaining({ profile }),
			);
			expect(service.get(verificationId)).toMatchObject({
				profile,
				error: null,
				confirmed: true,
			});
		},
	);

	it("ignores conflicting submit while DB confirmation is pending and confirms only once", async () => {
		const { service, verificationId, confirmAccount } = await setup();
		let finish!: (value: Author) => void;
		confirmAccount.mockImplementation(
			() =>
				new Promise((resolve) => {
					finish = resolve;
				}),
		);
		service.submit(verificationId, profile);
		const first = service.confirm(verificationId);
		expect(() =>
			service.submit(verificationId, { ...profile, username: "other" }),
		).toThrow();
		const second = service.confirm(verificationId);
		finish(author);
		await expect(first).resolves.toEqual(author);
		await expect(second).resolves.toEqual(author);
		expect(confirmAccount).toHaveBeenCalledTimes(1);
		expect(service.get(verificationId)).toMatchObject({
			confirmed: true,
			error: null,
		});
		await service.confirm(verificationId);
		expect(confirmAccount).toHaveBeenCalledTimes(1);
	});

	it("does not expose mutable profile or expiry references and still expires", async () => {
		const { service, verificationId, advance } = await setup();
		const view = service.submit(verificationId, profile);
		if (view.profile) view.profile.remoteId = "different";
		view.expiresAt.setFullYear(2099);
		expect(service.get(verificationId).profile).toEqual(profile);
		advance();
		expect(() => service.get(verificationId)).toThrow("期限切れ");
	});

	it("retains DB conflict protection and permits retry after a transient confirmation failure", async () => {
		const { service, verificationId, confirmAccount } = await setup();
		confirmAccount.mockRejectedValueOnce(new Error("changed at DB"));
		service.submit(verificationId, profile);
		await expect(service.confirm(verificationId)).rejects.toThrow(
			"changed at DB",
		);
		expect(service.get(verificationId)).toMatchObject({
			confirmed: false,
			profile,
		});
		await service.confirm(verificationId);
		expect(confirmAccount).toHaveBeenCalledTimes(2);
	});
});
