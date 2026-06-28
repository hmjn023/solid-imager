---
name: media-search
description: solid-imagerのメディア検索schema、simple/pro/vector mode、shared search store、session persistence、preset、検索API、無限スクロールを扱う。検索条件・mode・sort・類似検索・検索画面変更時に使用する。
---

# Media Search

## 既存設計

- schemaと型の正は`packages/core/src/domain/search/`とmedia schemaに置く。
- stateの正は`packages/ui/src/stores/search-store.ts`。server/Tauriは同じstoreをre-exportする。
- 検索状態はstoreと`use-current-search-persistence`の`sessionStorage`で保持する。URL queryへ別系統の状態を追加しない。
- simple/pro変換はcoreのsearch logicを経由する。
- user presetとcurrent session stateを区別する。一時的な類似元などを通常presetへ混ぜない。
- server/Tauri共通表示は`packages/ui`へ置き、app側はAPI clientとroute wiringだけを持つ。

## 変更手順

1. Zod `SearchState`とdefault stateを更新する。
2. mode遷移、condition生成、preset復元への影響を確認する。
3. session保存対象と復元処理を同時に更新する。
4. oRPC contract、router、application/repositoryの順で検索処理を追加する。
5. `useSearchPage`のquery keyへ結果を変える全stateを含める。
6. paginationを使わないmodeではnext pageを返さない。
7. 大量画像は既存のvirtualized gridとlazy loadingを維持する。

## Vector類似検索

- `vector`はsimple/proと独立した第三modeとして扱う。
- 個別media画面はstoreへanchor IDを設定して`/search`へ通常遷移する。
- URL queryは使用しない。
- source filterとtopKを明示し、通常sortは適用しない。
- CCIPはキャラクター類似であり一般的な重複画像検索ではないことをUIに表示する。

## 検証

mode遷移、session復元、preset非汚染、query key、server/Tauri parity、空結果、エラー、無限scroll停止を確認する。
