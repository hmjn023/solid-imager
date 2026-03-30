const fs = require('fs');
const filePath = 'apps/server/src/routes/__root.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace('<body>', '<body class="bg-[#131313] text-[#e5e2e1] min-h-screen">');
content = content.replace('<head>', '<head>\n\t\t\t\t<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />');

fs.writeFileSync(filePath, content);
