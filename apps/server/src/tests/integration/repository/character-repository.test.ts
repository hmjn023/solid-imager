import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/pglite/migrator";
import { afterEach, beforeAll, describe, expect, it } from "vite-plus/test";
import { db } from "~/infrastructure/db";
import { characterIps, characters, ips } from "~/infrastructure/db/schema";
import { DrizzleCharacterRepository } from "~/infrastructure/repositories/character-repository";

describe("CharacterRepository Multi-IP Support", () => {
	const repo = new DrizzleCharacterRepository();

	beforeAll(async () => {
		try {
			await db.execute("DROP SCHEMA IF EXISTS drizzle CASCADE");
			await db.execute("DROP SCHEMA IF EXISTS public CASCADE");
			await db.execute("CREATE SCHEMA public");
			await migrate(db, { migrationsFolder: "drizzle" });
		} catch (e) {
			console.error(e);
		}
	});

	afterEach(async () => {
		await db.delete(characterIps);
		await db.delete(characters);
		await db.delete(ips);
	});

	it("should create a character linked to multiple IPs", async () => {
		// 1. Create IPs
		const [ip1] = await db.insert(ips).values({ name: "Fate/Zero" }).returning();
		const [ip2] = await db.insert(ips).values({ name: "Fate/stay night" }).returning();

		// 2. Create Character
		const char = await repo.create({
			name: "Saber",
			ipIds: [ip1.id, ip2.id],
		});

		// 3. Verify
		expect(char.name).toBe("Saber");
		expect(char.ips).toHaveLength(2);
		expect(char.ips.map((i) => i.name).sort()).toEqual(["Fate/Zero", "Fate/stay night"].sort());

		// Verify DB directly
		const links = await db.select().from(characterIps).where(eq(characterIps.characterId, char.id));
		expect(links).toHaveLength(2);
	});

	it("should update character IPs", async () => {
		// 1. Create IPs
		const [ip1] = await db.insert(ips).values({ name: "IP1" }).returning();
		const [ip2] = await db.insert(ips).values({ name: "IP2" }).returning();
		const [ip3] = await db.insert(ips).values({ name: "IP3" }).returning();

		// 2. Create Character with IP1
		const char = await repo.create({
			name: "TestChar",
			ipIds: [ip1.id],
		});
		expect(char.ips).toHaveLength(1);
		expect(char.ips[0].id).toBe(ip1.id);

		// 3. Update to IP2, IP3
		const updatedChar = await repo.update(char.id, {
			ipIds: [ip2.id, ip3.id],
		});

		// 4. Verify
		expect(updatedChar.ips).toHaveLength(2);
		expect(updatedChar.ips.map((i) => i.id).sort()).toEqual([ip2.id, ip3.id].sort());

		// Verify IP1 link is gone
		const links = await db.select().from(characterIps).where(eq(characterIps.characterId, char.id));
		expect(links).toHaveLength(2);
		const linkIds = links.map((l) => l.ipId);
		expect(linkIds).not.toContain(ip1.id);
		expect(linkIds).toContain(ip2.id);
		expect(linkIds).toContain(ip3.id);
	});

	it("should remove all IPs when empty list passed", async () => {
		const [ip1] = await db.insert(ips).values({ name: "IP1" }).returning();
		const char = await repo.create({
			name: "TestChar",
			ipIds: [ip1.id],
		});

		const updatedChar = await repo.update(char.id, {
			ipIds: [],
		});

		expect(updatedChar.ips).toHaveLength(0);
		const links = await db.select().from(characterIps).where(eq(characterIps.characterId, char.id));
		expect(links).toHaveLength(0);
	});
});
