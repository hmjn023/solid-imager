const fs = require('fs');
const filePath = 'apps/server/src/components/media/media-sidebar.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Container
content = content.replace('class="h-full space-y-4 overflow-y-auto rounded-lg border bg-gray-50 p-4"', 'class="h-full space-y-4 overflow-y-auto rounded-lg bg-[#201f1f] p-6 text-[#e5e2e1] shadow-[0_12px_40px_rgba(59,71,93,0.08)] border border-[#353534]/50"');

// Headers & Text
content = content.replace('class="font-bold text-xl"', 'class="font-bold text-xl text-[#a0c4ff] font-[Manrope]"');
content = content.replace('class="text-gray-500 text-sm"', 'class="text-[#a9b6cf] text-sm"');

// Button
content = content.replace('class="flex w-full items-center justify-center gap-2 rounded-md bg-purple-600 px-3 py-2 font-medium text-sm text-white transition-colors hover:bg-purple-700"', 'class="flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-br from-[#cedfff] to-[#a0c4ff] px-3 py-2 font-medium text-sm text-[#003060] transition-colors hover:scale-[1.02]"');

// Collapsible UI
content = content.replace(/class="w-full cursor-pointer rounded-md bg-gray-200 px-3 py-2 text-left font-medium hover:bg-gray-300"/g, 'class="w-full cursor-pointer rounded-lg bg-[#353534] px-3 py-2 text-left font-medium text-[#e5e2e1] hover:bg-[#43474f]"');
content = content.replace(/class="mt-2 max-h-96 overflow-y-auto rounded-md bg-gray-100 p-2"/g, 'class="mt-2 max-h-96 overflow-y-auto rounded-lg bg-[#0e0e0e] p-3 text-[#c3c6d1]"');

// Info blocks
content = content.replace(/class="rounded-lg bg-white p-4 shadow-sm"/g, 'class="rounded-lg bg-[#1c1b1b] p-4 border border-[#353534]/30"');
content = content.replace(/class="mb-2 font-semibold"/g, 'class="mb-2 font-semibold text-[#bac7e1] font-[Manrope]"');
content = content.replace(/class="grid grid-cols-2 gap-2 text-sm"/g, 'class="grid grid-cols-2 gap-2 text-sm text-[#c3c6d1]"');
content = content.replace(/class="text-gray-500"/g, 'class="text-[#8d919a]"');
content = content.replace(/class="font-medium truncate"/g, 'class="font-medium truncate text-[#e5e2e1]"');
content = content.replace(/class="font-medium"/g, 'class="font-medium text-[#e5e2e1]"');
content = content.replace(/class="flex flex-wrap gap-2"/g, 'class="flex flex-wrap gap-2 mt-2"');

fs.writeFileSync(filePath, content);
