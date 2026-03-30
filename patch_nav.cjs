const fs = require('fs');
const filePath = 'apps/server/src/components/nav.tsx';
let content = fs.readFileSync(filePath, 'utf8');

content = content.replace(/bg-sky-800/g, 'bg-[#131313]/60 backdrop-blur-xl border-b border-[#353534]/50');
content = content.replace(/border-sky-600/g, 'border-[#a0c4ff] text-[#a0c4ff]');
content = content.replace(/text-gray-200/g, 'text-[#a9b6cf] font-[Manrope]');
content = content.replace(/hover:border-sky-600/g, 'hover:border-[#353534] hover:text-[#e5e2e1] transition-colors');

fs.writeFileSync(filePath, content);
