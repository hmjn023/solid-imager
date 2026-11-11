---
name: media-search
description: メディア検索の条件・mode・sort・状態保存・preset・類似検索・検索画面を変更する時に使用する。
---

# Media Search

## 既存設計

- 検索条件・状態・ソート順は `@solid-imager/core/search`、保存プリセットは `@solid-imager/core/presets` から取得する。実装はそれぞれ `packages/core/src/domain/search/` と `packages/core/src/domain/presets/` に置く。
- Web と Tauri は `@solid-imager/ui/search/state` から同じ検索ストアを直接 import する。
- 検索状態は共有store・sessionStorageで保持し、`useSearchHistoryPersistence` がhistory.stateとサーバースナップショットを管理する。URLは `?search=<snapshot UUID>` で復元し、検索条件そのものを別系統のqueryへ複製しない。
- simple/pro変換はcoreのsearch logicを経由する。
- user presetとcurrent session stateを区別する。一時的な類似元などを通常presetへ混ぜない。
- server/Tauri共通表示は`packages/ui`へ置き、app側はAPI clientとroute wiringだけを持つ。

## 変更手順

1. Zod `SearchState`とdefault stateを更新する。
2. mode遷移、condition生成、preset復元への影響を確認する。
3. session保存・history・snapshotのschemaと復元処理を同時に確認する。
4. oRPC contract、router、application/repositoryの順で検索処理を追加する。
5. `useSearchPage`のquery keyへ結果を変える全stateを含める。
6. 通常・類似・自然言語検索ともlimit/offsetでページングし、空ページまたはtotal到達で停止する。
7. 大量画像は既存のvirtualized gridとlazy loadingを維持する。

## 類似・自然言語検索

- modeは `simple/pro` のみ。類似検索は `similarityAnchorMediaId`・`similarityModel`、自然言語検索は `semanticQuery` で表す。
- 個別media画面では `activateSimilaritySearch` でanchor・model・topKと表示位置を設定し、`/search`へ遷移する。modelは `ccip` / `embeddinggemma2`。
- source filterとtopKを明示する。類似・自然言語検索は類似度順で、通常sortを適用しない。
- CCIPはキャラクター類似であり一般的な重複画像検索ではないことをUIに表示する。

## 検証

mode遷移、session・戻る/進む・snapshot URLからの復元、preset非汚染、query key、server/Tauri parity、空結果、エラー、ページング停止を確認する。
