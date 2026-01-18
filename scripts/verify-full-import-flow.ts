import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "../src/domain/shared/api-contract";

async function verify() {
  const url = "http://localhost:3001/api/rpc";
  console.log(`Connecting to ${url}...`);

  const link = new RPCLink({ url });
  const client = createORPCClient(link) as RouterClient<AppRouter>;

  try {
    // 1. Get a valid source ID
    const sources = await client.sources.list();
    if (sources.length === 0) throw new Error("No media sources found");
    const sourceId = sources[0].id;
    console.log(`Using source: ${sources[0].name} (${sourceId})`);

    // 2. Send preview data (Phase 1 & 2 logic)
    console.log("Step 1: Sending preview request...");
    const previewResult = await client.downloads.preview({
      mediaSourceId: sourceId,
      items: [
        {
          imageUrl: "https://pbs.twimg.com/media/Example.jpg",
          sourceUrl: "https://twitter.com/user/status/123",
          description: "Full flow verification test",
          author: { name: "Full Flow Tester", accountId: "@tester" },
          tags: [
            { name: "integration-test", type: "positive" },
            { name: "bulk-import", type: "positive" }
          ]
        }
      ]
    });
    console.log(`Preview saved. Job ID: ${previewResult.jobId}`);

    // 3. List pending jobs (Phase 3 logic)
    console.log("Step 2: Listing pending jobs...");
    const pending = await client.downloads.listPending();
    const found = pending.find(j => j.id === previewResult.jobId);
    if (!found) throw new Error("Pending job not found in list");
    console.log("Found pending job in list.");

    // 4. Approve the job (Phase 3 logic)
    console.log("Step 3: Approving job...");
    const approveResult = await client.downloads.approve({
      jobId: previewResult.jobId,
      selectedIndices: [0],
      mediaSourceId: sourceId,
    });
    console.log(`Approved! Result: ${approveResult.message}`);

    // 5. Verify data in DB (Optional but recommended)
    // Here we could check if Media/Tags records were created
    
    console.log("\nFull Integration Flow Verified Successfully!");
  } catch (error) {
    console.error("\nVerification failed:");
    console.error(error);
    process.exit(1);
  }
}

verify();
