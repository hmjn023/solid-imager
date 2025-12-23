import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { db } from "~/infrastructure/db";
import { NotFoundError } from "~/infrastructure/db/errors";
import {
  deleteIp,
  insertIp,
  selectIpById,
  selectIps,
  updateIp,
} from "~/infrastructure/db/queries/ips";
import { ips, type NewIp } from "~/infrastructure/db/schema";

describe("ips queries Integration", () => {
  let testIpId: string;

  beforeAll(async () => {
    await db.delete(ips);
    const initialIp: NewIp = {
      name: "Initial IP",
      description: "An IP for testing",
    };
    const inserted = await db.insert(ips).values(initialIp).returning();
    testIpId = inserted[0].id;
  });

  afterAll(async () => {
    // Clean up all data
    await db.delete(ips);
  });

  it("should select all ips", async () => {
    const result = await selectIps();
    expect(result).toBeInstanceOf(Array);
    expect(result.length).toBeGreaterThanOrEqual(1);
  });

  it("should select an ip by its ID", async () => {
    const ip = await selectIpById(testIpId);
    expect(ip).toBeDefined();
    expect(ip.id).toBe(testIpId);
    expect(ip.name).toBe("Initial IP");
  });

  it("should throw NotFoundError when selecting a non-existent ip", async () => {
    const nonExistentId = "00000000-0000-0000-0000-000000000000";
    await expect(selectIpById(nonExistentId)).rejects.toThrow(NotFoundError);
  });

  it("should insert a new ip", async () => {
    const newIp: NewIp = { name: "New Test IP" };
    const inserted = await insertIp(newIp);
    expect(inserted).toBeDefined();
    expect(inserted[0].name).toBe(newIp.name);

    // Verify in DB
    const selected = await selectIpById(inserted[0].id);
    expect(selected).toBeDefined();

    // Cleanup
    await deleteIp(inserted[0].id);
  });

  it("should update an existing ip", async () => {
    const updatedName = "Updated IP Name";
    const updated = await updateIp(testIpId, { name: updatedName });
    expect(updated).toBeDefined();
    expect(updated.name).toBe(updatedName);

    // Verify in DB
    const selected = await selectIpById(testIpId);
    expect(selected.name).toBe(updatedName);
  });

  it("should delete an ip", async () => {
    const ipToDelete: NewIp = { name: "To Be Deleted" };
    const inserted = await insertIp(ipToDelete);
    const insertedId = inserted[0].id;

    await deleteIp(insertedId);

    // Verify it's gone
    await expect(selectIpById(insertedId)).rejects.toThrow(NotFoundError);
  });
});
