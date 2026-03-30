const fs = require('fs');
const filePath = 'apps/server/src/components/media/media-viewer.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('class="flex h-full w-full items-center justify-center bg-black/5"', 'class="flex h-full w-full items-center justify-center bg-[#0e0e0e] rounded-lg shadow-inner"');

fs.writeFileSync(filePath, content);
