const fs = require('fs');
const filePath = 'apps/server/src/routes/sources/$mediaSourceId/$mediaId/index.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('class="container mx-auto p-4"', 'class="container mx-auto min-h-[calc(100vh-2rem)] p-4 bg-[#131313] text-[#e5e2e1]"');

fs.writeFileSync(filePath, content);
