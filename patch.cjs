const fs = require('fs');
const filePath = 'apps/server/src/routes/sources/$mediaSourceId/index.tsx';
let content = fs.readFileSync(filePath, 'utf8');

// Container
content = content.replace('class="container mx-auto min-h-[calc(100vh-2rem)] p-4"', 'class="container mx-auto min-h-[calc(100vh-2rem)] p-4 bg-[#131313] text-[#e5e2e1]"');

// Title
content = content.replace('class="font-bold text-2xl"', 'class="font-bold text-2xl text-[#a0c4ff]"');

// Buttons
content = content.replace(/class="mr-2 border-white text-white hover:bg-sky-700"/g, 'class="mr-2 border-[#353534] bg-[#201f1f] text-[#a0c4ff] hover:bg-[#353534]"');
content = content.replace('class="border-white text-white hover:bg-sky-700 md:hidden"', 'class="border-[#353534] bg-[#201f1f] text-[#a0c4ff] hover:bg-[#353534] md:hidden"');
content = content.replace('disabled={isSyncingMedia() || !mediaQuery.data?.pages.length}\n\t\t\t\t\tonClick={handleSyncLoadedMedia}\n\t\t\t\t\tvariant="outline"\n\t\t\t\t>\n\t\t\t\t\t{isSyncingMedia() ? "Syncing..." : "Sync Loaded Media"}', 'class="border-[#353534] bg-[#201f1f] text-[#a0c4ff] hover:bg-[#353534]"\n\t\t\t\t\tdisabled={isSyncingMedia() || !mediaQuery.data?.pages.length}\n\t\t\t\t\tonClick={handleSyncLoadedMedia}\n\t\t\t\t\tvariant="outline"\n\t\t\t\t>\n\t\t\t\t\t{isSyncingMedia() ? "Syncing..." : "Sync Loaded Media"}');
content = content.replace('class="fixed right-8 bottom-8 flex h-14 w-14 items-center justify-center rounded-full bg-blue-600 text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl"', 'class="fixed right-8 bottom-8 flex h-14 w-14 items-center justify-center rounded-lg bg-gradient-to-br from-[#cedfff] to-[#a0c4ff] text-[#003060] shadow-lg transition-all hover:scale-105 hover:shadow-xl"');

// Card (Sidebar)
content = content.replace('class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block"', 'class="sticky top-20 hidden h-fit max-h-[calc(100vh-6rem)] overflow-y-auto md:block bg-[#1c1b1b] border-none shadow-none"');

// Media items
content = content.replace('class="relative block aspect-[3/4] overflow-hidden rounded-lg bg-gray-100 transition-all hover:shadow-md"', 'class="relative block aspect-[3/4] overflow-hidden rounded-lg bg-[#201f1f] transition-all duration-200 hover:scale-[1.02] hover:bg-[#353534] hover:shadow-[0_12px_40px_rgba(59,71,93,0.08)]"');

fs.writeFileSync(filePath, content);
