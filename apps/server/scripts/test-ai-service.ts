import { taggingService } from "~/application/services/tagging-service";
import fs from "node:fs/promises";
import path from "node:path";

async function main() {
  console.log("Checking AI Service availability...");
  const available = await taggingService.isServiceAvailable();
  if (!available) {
    console.error(
      "AI Service is not available. Please run 'bun run ai:start' in a separate terminal.",
    );
    process.exit(1);
  }
  console.log("AI Service is available!");

  const imagePath = process.argv[2];
  if (!imagePath) {
    console.error("Please provide an image path as an argument.");
    process.exit(1);
  }

  console.log(`Reading image from ${imagePath}...`);
  const imageBuffer = await fs.readFile(path.resolve(imagePath));

  console.log("Requesting tags...");
  const tags = await taggingService.getTags(imageBuffer.buffer as ArrayBuffer);
  console.log("Tags received:", JSON.stringify(tags, null, 2));

  console.log("Requesting CCIP feature...");
  const feature = await taggingService.getCcipFeature(imageBuffer.buffer as ArrayBuffer);
  console.log("CCIP Feature length:", feature.feature.length);
}

main().catch(console.error);
