import fs from 'node:fs';
import path from 'node:path';

const targetPath = path.resolve(__dirname, '../node_modules/vite-plugin-solid/dist/esm/index.mjs');

// Helper to find the file in nested node_modules if not found in root (e.g. monorepo hoisting issues)
function findFile(startPath) {
    if (fs.existsSync(startPath)) return startPath;
    // Helper logic could be expanded, but for now fallback to known locations if needed
    // Check inside .bun/vite-plugin-solid... directory if predictable, but standard resolution should suffice
    // if using "bun run" usually node_modules structure is standard-ish.
    return null;
}

// In Bun, files might be in a different structure, but usually node_modules/vite-plugin-solid should exist via symlinks.
// However, the error log showed: file:///home/hmjn/solid-imager/node_modules/.bun/vite-plugin-solid@2.11.10...
// So we leverage `require.resolve` or similar to find it? 
// Actually, let's try to locate it relative to CWD.

const possiblePaths = [
    'node_modules/vite-plugin-solid/dist/esm/index.mjs',
    '../../node_modules/vite-plugin-solid/dist/esm/index.mjs' // if specific package context
];

let fileToPatch = null;
for (const p of possiblePaths) {
    const resolved = path.resolve(process.cwd(), p);
    if (fs.existsSync(resolved)) {
        fileToPatch = resolved;
        break;
    }
}

if (!fileToPatch) {
    console.warn('Could not find vite-plugin-solid to patch. Skipping.');
    process.exit(0);
}

console.log(`Patching vite-plugin-solid at ${fileToPatch}`);

let content = fs.readFileSync(fileToPatch, 'utf8');

// The problematic line is spreading config.resolve.conditions which might be undefined/null
// We want to replace the sequence where it does the spread.
// Specifically matching the unconditional assignment at the end of `configEnvironment`.

const searchString = `config.resolve.conditions = ['solid', ...(replaceDev ? ['development'] : []), ...(isTestMode && !opts.isSsrTargetWebworker && !options.ssr ? ['browser'] : []), ...config.resolve.conditions];`;
const replacementString = `const currentConditions = Array.isArray(config.resolve.conditions) ? config.resolve.conditions : [];
      config.resolve.conditions = ['solid', ...(replaceDev ? ['development'] : []), ...(isTestMode && !opts.isSsrTargetWebworker && !options.ssr ? ['browser'] : []), ...currentConditions];`;

if (content.includes(searchString)) {
    content = content.replace(searchString, replacementString);
    fs.writeFileSync(fileToPatch, content, 'utf8');
    console.log('Successfully patched vite-plugin-solid.');
} else if (content.includes('const currentConditions = Array.isArray')) {
    console.log('vite-plugin-solid already patched.');
} else {
    // Try a more loose match if exact string fails (due to formatting)
    // Be careful not to break usage in line 140 vs line 137 (in previous exploration)
    // The target is the one followed by "// Set resolve.noExternal"
    const regex = /config\.resolve\.conditions\s*=\s*\['solid'.*?\.\.\.config\.resolve\.conditions\];/s;
    if (regex.test(content)) {
        // This regex is risky if it matches multiple times. The file has multiple assignments.
        // We specifically want the one that is NOT inside the if/else block (if possible).
        // Actually, let's try to verify if we can find the exact block.
        console.warn('Could not find exact match to patch in vite-plugin-solid. Attempting regex safe patch...');

        const safeReplacement = `
         const currentConditions = Array.isArray(config.resolve.conditions) ? config.resolve.conditions : [];
         config.resolve.conditions = ['solid', ...(replaceDev ? ['development'] : []), ...(isTestMode && !opts.isSsrTargetWebworker && !options.ssr ? ['browser'] : []), ...currentConditions];
         `;
        // We only want to replace the occurrence that is causing issues.
        // Given the complexity, failing gracefully is better.
        console.error('Exact match failed. Please check vite-plugin-solid version.');
        process.exit(0);
    }
    console.warn('Could not find code to patch in vite-plugin-solid.');
}
