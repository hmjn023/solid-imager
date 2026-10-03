import { createAuthorAccountVerificationService } from "@solid-imager/application/services/author-account-verification-service";
import { eq } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import {
	authorAccounts,
	authors,
	mediaSources,
	medias,
} from "~/infrastructure/db/schema";
import { AuthorRepository } from "~/infrastructure/repositories/author-repository";
import { AuthorService } from "~/infrastructure/services/author-service";

describe("manual X account confirmation", () => {
	afterEach(async () => {
		await db.delete(authors);
		await db.delete(mediaSources);
	});
	const profile = {
		remoteId: "18446744073709551615",
		username: "current_name",
		displayName: "Current display",
	};
	it("attaches a verified account to a name-only author without replacing the author", async () => {
		const service = createAuthorAccountVerificationService(AuthorService);
		const author = await AuthorRepository.create({ name: "Name-only creator" });
		const pending = await service.begin({
			authorId: author.id,
			accountId: null,
			username: "current_name",
		});
		service.submit(pending.verificationId, profile);
		const verified = await service.confirm(pending.verificationId);
		expect(verified.id).toBe(author.id);
		expect(verified.name).toBe(author.name);
		expect(verified.accounts).toEqual([
			expect.objectContaining({
				platform: "twitter",
				remoteId: profile.remoteId,
			}),
		]);
		await expect(
			service.begin({
				authorId: author.id,
				accountId: null,
				username: "current_name",
			}),
		).rejects.toThrow("登録済みのアカウント");
	});
	async function preview(
		service = createAuthorAccountVerificationService(AuthorService),
	) {
		const created = await AuthorRepository.create({
			name: "Legacy display",
			accountId: "old_name",
		});
		const author = await AuthorRepository.update(created.id, {
			name: "Managed creator",
		});
		const account = author.accounts?.[0];
		if (!account) throw new Error("Missing test account");
		const pending = await service.begin({
			authorId: author.id,
			accountId: account.id,
			username: "current_name",
		});
		return { service, author, account, pending };
	}
	it("stages a username result without changing data, then promotes in place and tracks future renames", async () => {
		const { service, author, account, pending } = await preview();
		const [source] = await db
			.insert(mediaSources)
			.values({
				name: "Test",
				connectionInfo: { path: "/tmp/verification" },
				type: "local",
			})
			.returning();
		const [media] = await db
			.insert(medias)
			.values({
				mediaSourceId: source.id,
				filePath: "/test.png",
				fileName: "test.png",
				mediaType: "image",
				width: 100,
				height: 100,
			})
			.returning();
		await AuthorRepository.addMedia(media.id, author.id);
		await expect(service.confirm(pending.verificationId)).rejects.toThrow(
			"プロフィール取得後",
		);
		service.submit(pending.verificationId, profile);
		expect(
			(await AuthorRepository.findById(author.id))?.accounts?.[0],
		).toMatchObject({
			id: account.id,
			remoteId: null,
			accountId: "old_name",
			platform: null,
		});
		const updated = await service.confirm(pending.verificationId);
		expect(updated.id).toBe(author.id);
		expect(updated.name).toBe("Managed creator");
		expect(updated.accounts?.[0]).toMatchObject({
			id: account.id,
			remoteId: profile.remoteId,
			platform: "twitter",
			accountId: "current_name",
			displayName: profile.displayName,
		});
		expect(
			(await AuthorRepository.findByMediaId(media.id)).map((item) => item.id),
		).toEqual([author.id]);
		expect((await service.confirm(pending.verificationId)).id).toBe(author.id);
		const renamed = await AuthorRepository.create({
			name: "Renamed display",
			platform: "twitter",
			accountId: "next_name",
			remoteId: profile.remoteId,
			observedAt: new Date(Date.now() + 1000),
		});
		expect(renamed.id).toBe(author.id);
		expect(renamed.accounts?.[0]).toMatchObject({
			id: account.id,
			accountId: "next_name",
			displayName: "Renamed display",
		});
		expect(renamed.name).toBe("Managed creator");
	});
	it("rejects a stale preview and preserves all fields", async () => {
		const { service, account, author, pending } = await preview();
		service.submit(pending.verificationId, profile);
		await db
			.update(authorAccounts)
			.set({ updatedAt: new Date(account.updatedAt.getTime() + 1000) })
			.where(eq(authorAccounts.id, account.id));
		await expect(service.confirm(pending.verificationId)).rejects.toThrow(
			"変更されています",
		);
		expect(
			(await AuthorRepository.findById(author.id))?.accounts?.[0]?.remoteId,
		).toBeNull();
	});
	it("requires explicit author merge if the immutable ID already belongs to another account", async () => {
		const existing = await AuthorRepository.create({
			name: "Existing",
			accountId: profile.username,
			platform: "twitter",
			remoteId: profile.remoteId,
		});
		const { service, author, pending } = await preview();
		service.submit(pending.verificationId, profile);
		await expect(service.confirm(pending.verificationId)).rejects.toThrow(
			"作者を統合",
		);
		expect(
			(await AuthorRepository.findById(author.id))?.accounts?.[0]?.remoteId,
		).toBeNull();
		expect(
			(await AuthorRepository.findById(existing.id))?.accounts?.[0]?.remoteId,
		).toBe(profile.remoteId);
	});
	it("rejects another username and never replaces an existing verified ID", async () => {
		const { service, pending } = await preview();
		expect(() =>
			service.submit(pending.verificationId, { ...profile, username: "other" }),
		).toThrow("一致しません");
		expect(service.get(pending.verificationId).error).toContain("一致しません");
		const author = await AuthorRepository.create({
			name: "Verified",
			accountId: "current_name",
			platform: "twitter",
			remoteId: "123",
		});
		const account = author.accounts?.[0];
		if (!account) throw new Error("Missing verified account");
		const verified = await service.begin({
			authorId: author.id,
			accountId: account.id,
			username: "current_name",
		});
		expect(() => service.submit(verified.verificationId, profile)).toThrow(
			"異なるアカウント",
		);
		await expect(service.confirm(verified.verificationId)).rejects.toThrow(
			"プロフィール取得後",
		);
	});
	it("freezes the displayed result and rejects expired verification tokens", async () => {
		let now = new Date();
		const service = createAuthorAccountVerificationService(
			AuthorService,
			undefined,
			() => now,
		);
		const { pending } = await preview(service);
		service.submit(pending.verificationId, profile);
		expect(() =>
			service.submit(pending.verificationId, {
				...profile,
				displayName: "Changed",
			}),
		).toThrow("取得結果が変化");
		expect(service.get(pending.verificationId).profile?.displayName).toBe(
			profile.displayName,
		);
		now = new Date(now.getTime() + 10 * 60 * 1000);
		await expect(service.confirm(pending.verificationId)).rejects.toThrow();
		expect(() => service.get(pending.verificationId)).toThrow();
	});
});
