import { createORPCClient } from "@orpc/client";
import { RPCLink } from "@orpc/client/fetch";
import type { RouterClient } from "@orpc/server";
import type { AppRouter } from "../src/domain/shared/api-contract";

async function verify() {
  const url = "http://localhost:3001/api/rpc"; // Using the port vinxi used
  console.log(`Connecting to ${url}...`);

  const link = new RPCLink({
    url: url,
  });

  const client = createORPCClient(link) as RouterClient<AppRouter>;

  try {
    console.log("Sending preview request...");
    const result = await client.downloads.preview({
      items: [
        {
          imageUrl: "https://example.com/test.jpg",
          description: "oRPC Script Test",
          author: { name: "oRPC Tester" },
          tags: [{ name: "script-test", type: "positive" }]
        }
      ]
    });

    console.log("Success!");
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error("Verification failed:");
    console.error(error);
    process.exit(1);
  }
}

verify();
