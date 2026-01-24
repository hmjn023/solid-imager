---
trigger: always_on
description: Bun固有APIの使用回避
---
### Bun固有APIの回避

ポータビリティを確保するため、`Bun.file()` のようなBun固有のAPIの使用は避け、可能な限りNode.js互換のAPIやWeb標準APIを使用してください。
