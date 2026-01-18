import { eq } from "drizzle-orm";
import { db } from "../src/infrastructure/db";
import { jobs } from "../src/infrastructure/db/schema";

/**
 * Script to delete all jobs with 'pending_approval' status.
 * Usage: bun scripts/delete-pending-jobs.ts
 */
async function main() {
  console.log("🧹 Cleaning up pending approval jobs...");

  try {
    const deleted = await db
      .delete(jobs)
      .where(eq(jobs.status, "pending_approval"))
      .returning({ id: jobs.id });

    if (deleted.length > 0) {
      console.log(`✅ Successfully deleted ${deleted.length} pending jobs.`);
    } else {
      console.log("✨ No pending jobs found.");
    }
  } catch (error) {
    console.error("❌ Failed to delete pending jobs:", error);
    process.exit(1);
  }

  process.exit(0);
}

main();
