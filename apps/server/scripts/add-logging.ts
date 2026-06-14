#!/usr/bin/env bun

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const sourcesDir = "/home/hmjn/projects/web/solid-imager/src/routes/api/sources";

function addLoggerToFile(filePath: string): boolean {
  try {
    let content = readFileSync(filePath, "utf-8");
    let modified = false;

    // Check if logger is already imported
    if (!content.includes('from "~/infrastructure/logger"')) {
      // Add import after the last import statement
      const importRegex = /(import[^;]+;)\n(?!import)/;
      content = content.replace(
        importRegex,
        '$1\nimport { logger } from "~/infrastructure/logger";\n',
      );
      modified = true;
    }

    // Add logger.error to catch blocks that return 500 without logging
    const catch500Regex =
      /(} catch \([^)]+\) \{[^}]*)(return new Response\(JSON\.stringify\(\{ error:[^}]+\}\),\s*\{\s*status:\s*(?:500|HTTP_STATUS_INTERNAL_SERVER_ERROR))/g;

    const newContent = content.replace(catch500Regex, (match, before, returnStatement) => {
      if (before.includes("logger.error") || before.includes("logger.warn")) {
        return match; // Already has logging
      }
      return `${before}logger.error({ err: error }, "Request failed");\n    ${returnStatement}`;
    });

    if (newContent !== content) {
      modified = true;
      content = newContent;
    }

    if (modified) {
      writeFileSync(filePath, content, "utf-8");
      console.log(`✓ Updated: ${filePath}`);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error);
    return false;
  }
}

function processDirectory(dir: string): number {
  let count = 0;
  const entries = readdirSync(dir);

  for (const entry of entries) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);

    if (stat.isDirectory()) {
      count += processDirectory(fullPath);
    } else if (entry.endsWith(".ts") && !entry.endsWith(".d.ts")) {
      if (addLoggerToFile(fullPath)) {
        count++;
      }
    }
  }

  return count;
}

const updatedCount = processDirectory(sourcesDir);
console.log(`\n✓ Updated ${updatedCount} files`);
