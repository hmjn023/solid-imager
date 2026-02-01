import fs from 'node:fs';
import path from 'node:path';

// --- Helper ---
function findFile(paths) {
    for (const p of paths) {
        const resolved = path.resolve(process.cwd(), p);
        if (fs.existsSync(resolved)) {
            return resolved;
        }
    }
    return null;
}

function patchFile(filePath, patches) {
    if (!filePath) return;
    console.log(`Patching ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    for (const patch of patches) {
        if (content.includes(patch.search)) {
            content = content.replace(patch.search, patch.replace);
            console.log(`Applied patch: ${patch.name}`);
            modified = true;
        } else if (content.includes(patch.check)) {
            console.log(`Patch already applied: ${patch.name}`);
        } else {
            // Optional: check for partial match or warn
            if (patch.optional) {
                console.warn(`Could not find code for optional patch: ${patch.name}`);
            } else {
                console.warn(`Could not find code for patch: ${patch.name}`);
            }
        }
    }

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Successfully updated ${path.basename(filePath)}.`);
    } else {
        console.log(`No changes needed for ${path.basename(filePath)}.`);
    }
}

// --- vite-plugin-solid ---
const solidPluginPath = findFile([
    'node_modules/vite-plugin-solid/dist/esm/index.mjs',
    '../../node_modules/vite-plugin-solid/dist/esm/index.mjs'
]);

if (solidPluginPath) {
    patchFile(solidPluginPath, [
        {
            name: 'spread fix',
            search: `config.resolve.conditions = ['solid', ...(replaceDev ? ['development'] : []), ...(isTestMode && !opts.isSsrTargetWebworker && !options.ssr ? ['browser'] : []), ...config.resolve.conditions];`,
            replace: `const currentConditions = Array.isArray(config.resolve.conditions) ? config.resolve.conditions : [];
      config.resolve.conditions = ['solid', ...(replaceDev ? ['development'] : []), ...(isTestMode && !opts.isSsrTargetWebworker && !options.ssr ? ['browser'] : []), ...currentConditions];`,
            check: 'const currentConditions = Array.isArray'
        },
        {
            name: 'client conditions fix',
            search: `config.resolve.conditions = [...defaultClientConditions];`,
            replace: `config.resolve.conditions = [...(defaultClientConditions || [])];`,
            check: `config.resolve.conditions = [...(defaultClientConditions || [])];`
        },
        {
            name: 'server conditions fix',
            search: `config.resolve.conditions = [...defaultServerConditions];`,
            replace: `config.resolve.conditions = [...(defaultServerConditions || [])];`,
            check: `config.resolve.conditions = [...(defaultServerConditions || [])];`
        }
    ]);
} else {
    console.warn('vite-plugin-solid not found.');
}

// --- @tailwindcss/vite ---
const tailwindPluginPath = findFile([
    'node_modules/@tailwindcss/vite/dist/index.mjs',
    '../../node_modules/@tailwindcss/vite/dist/index.mjs'
]);

if (tailwindPluginPath) {
    patchFile(tailwindPluginPath, [
        {
            name: 'createIdResolver crash fix',
            search: `if(n){let o=D.createIdResolver(n.config,`,
            replace: `if(n&&D.createIdResolver){let o=D.createIdResolver(n.config,`,
            check: `if(n&&D.createIdResolver){`
        }
    ]);
} else {
    console.warn('@tailwindcss/vite not found.');
}
