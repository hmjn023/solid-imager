# Web レンダリング戦略

## 目的

`apps/server` の主要ルートについて、SSR、Solid Query の preload/hydration、SPA 遷移を一貫した方針で運用する。直接アクセスと F5 で意味のある HTML を返しつつ、hydration 後の重複 API リクエストを防ぐことを優先する。

Tauri は `apps/server` の SSR 方針へ含めない。`apps/tauri` は独立した SPA として扱い、共有 UI のみを再利用する。

## ルート分類

| ルート                                            | 方式                                          | サーバーが返す内容         | hydration 後                              |
| ------------------------------------------------- | --------------------------------------------- | -------------------------- | ----------------------------------------- |
| Sources (`/sources`)                              | Full data SSR                                 | ソース一覧を含む完成状態   | hydrate 済み Query cache を利用           |
| Config (`/config`)                                | Full data SSR                                 | 設定値を含む完成状態       | hydrate 済み Query cache を利用           |
| Search (`/search`)                                | SSR static fallback + Query preload/hydration | 検索画面固有の準備表示     | session 状態を復元後、検索結果を 1 回取得 |
| Manager (`/manager`)                              | SSR static fallback + Query preload/hydration | 管理画面固有の準備表示     | preload 済みマスターデータで本体を表示    |
| Source Media (`/sources/$mediaSourceId`)          | SSR static fallback + Query preload/hydration | ソース内一覧固有の準備表示 | session 状態を復元後、検索結果を 1 回取得 |
| Media Detail (`/sources/$mediaSourceId/$mediaId`) | SSR static fallback + Query preload/hydration | 詳細画面固有の準備表示     | preload 済み詳細データで本体を表示        |

主要な server ルートに pure CSR は置かない。Search、Manager、Source Media、Media Detail も `ssr: true` とし、サーバーとクライアント初回 render で同じ static fallback の component tree を使う。ブラウザ専用 UI は mount 後に表示する。Media Detail 内の Kobalte 依存部分は `ClientOnly` 境界を維持する。

方式の選択基準は次のとおり。

1. request 時点で query key が確定し、component tree が server-safe なら Full data SSR を使う。
2. 安定した query は server preload できる一方、画面本体がブラウザ API や client-only UI に依存する場合は SSR static fallback + Query hydration を使う。
3. `data-only` SSR は server/client の hydration tree が一致することを dev と production の E2E で証明できる場合だけ採用する。
4. Pure CSR は server で意味のある HTML や安定データを返せない場合の最終手段とし、採用時は intent preload とページ固有 pending UI を必須にする。

### `data-only` SSR を採用しない理由

現行の `@tanstack/solid-router` で `ssr: "data-only"` を試したところ、見た目が同じ fallback でもサーバーとクライアントの hydration key 階層が一致せず、`Hydration Mismatch. Unable to find DOM nodes for hydration key` を実測した。このため、現時点では `ssr: true` と同一 component tree の static fallback を採用する。

依存ライブラリ更新後に再検討する場合は、見た目や HTTP status だけで判断せず、dev と production の直接アクセス、F5、SPA 遷移を E2E で検証し、hydration warning が 0 件であることを採用条件とする。

## Router と Query の不変条件

1. server loader が in-process oRPC を呼ぶ前に、service/repository の bootstrap 完了を必ず待つ。初期化は module-scoped Promise で共有する。途中失敗後に部分初期化済みの service graph を配信しないよう、失敗した Promise も保持して fail-fast とし、復旧には process restart を要求する。
2. server の `QueryClient` は request ごとに新規作成する。request 間で cache や利用者固有データを共有しない。
3. client の `QueryClient` は singleton とし、SPA 遷移と再訪で cache を再利用する。
4. router とその context の `QueryClient` に対して `setupRouterSsrQueryIntegration` を設定し、loader が preload した cache を同じ query key で dehydrate/hydrate する。
5. loader と画面が同じ query を扱う場合は共有 query option builder を使う。query key、page size、検索条件を別々に組み立てない。session 依存 primary query は loader から除外し、画面側の共有 builder だけで組み立てる。
6. server HTML とクライアント初回 render の component tree を一致させる。hydration error を error component で隠さない。
7. TanStack Router の intent preload を SPA 遷移の標準とする。独自の hover handler や同一 query の先行 fetch を追加しない。
8. 初回 hydration の完了は `html[data-hydrated="true"]` で明示する。SSR HTML は `false`、root の `onMount` 後だけ `true` とし、E2E は SSR DOM の可視性を interaction ready の代用にしない。SPA 遷移ではこの marker は既に `true` のため、route 固有の ready 条件も併用する。

## Search と session 状態の例外

Search と Source Media の検索条件は `sessionStorage` から復元するため、cold SSR 時点では最終的な query key を決定できない。server loader はタグ、ソース、プロジェクト、IP、キャラクター、作者など、session 状態に依存しない filter query だけを preload する。

server loader と client intent loader は、共有 store を変更せず filter query だけを preload する。intent hover は navigation ではないため、ここで `sessionStorage` の内容を global search store へ適用してはならない。

実際に画面が mount された後は次の順序を守る。

1. 保存済み検索状態を復元する。
2. 復元後の条件から primary `media.search` query を組み立てる。
3. 復元完了 Accessor を条件に結果 query を有効化する。

これにより、初期値での不要な検索と復元後の再検索という二重発火を避ける。filter query は SSR cache を hydrate するため browser では再取得せず、primary `media.search` だけを cold load / reload ごとに 1 回許可する。

保存済み local preset は同期的に適用する。preset 名との照合は画面の Preset Manager が取得する一覧から行い、`presets.list` を primary query の前段に置かない。保存条件がある場合も `media.search` までの waterfall と同一 endpoint の重複取得を増やさない。

## データフローと request budget

### URL 直接アクセス / F5

```text
request
  -> server bootstrap 完了
  -> request-scoped QueryClient で loader preload
  -> route HTML + dehydrated Query cache
  -> browser hydrate
  -> preload 済み query の HTTP 再取得 0 回
  -> session 依存 primary query のみ 1 回
```

- SSR HTML に route 固有の内容を含め、汎用 pending/error 表示を含めない。
- preload/hydrate 対象 endpoint の browser HTTP request は 0 回とする。
- Search と Source Media の `media.search` はそれぞれ 1 回とする。
- 保存済み Search session がある場合も `presets.list` は最大 1 回とし、primary query を block しない。
- 直接アクセスと reload の両方で同じ条件を満たす。

### SPA 遷移 / cache 再訪

```text
link intent
  -> route loader がroute-stable queryだけをpreload
  -> client singleton QueryClient に格納
  -> navigation
  -> session復元後にprimary queryを最大1回実行
  -> preload/cache から render
  -> 再訪でも stale policy に従い最大 1 request
```

- SPA 遷移中、対象 endpoint はそれぞれ最大 1 回とする。
- Search から Sources へ遷移する場合、既存の `sources.list` cache を使い browser request は 0 回とする。
- Source Media の `media.search`、Media Detail の preload 対象、Search 再訪の `media.search` はそれぞれ最大 1 回とする。
- duplicate request は navigation 区間ごとに計測し、前の画面の通信と混同しない。

## 性能ベースライン

Issue #594 着手前に isolated E2E fixture で計測した代表値。単位は ms、各セルは `直接アクセス / reload` を表す。

| ルート       |         dev | production |
| ------------ | ----------: | ---------: |
| Search       |  3067 / 395 |  275 / 197 |
| Config       | 1138 / 1039 |  877 / 845 |
| Manager      | 1102 / 1003 |  882 / 854 |
| Sources      | 1124 / 1044 |  901 / 844 |
| Source Media |  1124 / 436 |   161 / 93 |
| Media Detail |  2153 / 539 |   152 / 84 |

計測値はマシン負荷で変動するため、上記そのものを assertion には使わない。回帰検知には次の余裕を持たせた budget を使う。

### dev server 起動・初回アクセスの計測

`bun run --cwd apps/server measure:dev-startup` は、通常の `bun dev` と同じ Vite plugin 構成を、PGlite・メディア・route tree を含む隔離した `/tmp` runtime で起動する。ユーザーの DB、設定、メディアへ接続してはならない。サーバーと browser 計測を別プロセスにし、TLS の準備が SSR 計測へ混入しないようにする。

```bash
# 標準の dev 構成
bun run --cwd apps/server measure:dev-startup

# mkcert / Devtools の固定コストを個別に比較する
bun run --cwd apps/server measure:dev-startup -- --profile=without-mkcert
bun run --cwd apps/server measure:dev-startup -- --profile=without-devtools
```

各実行は次を JSON で返す。値の大小を比較する際は、同一ホストで複数回実行し、profile 以外の条件を変えない。

1. `startupToListeningMs`: `bun dev` spawn から Vite の `Local` listen log まで。
2. `startupToStaticReadyMs` / `listeningToStaticReadyMs`: spawn / listening から Vite が static な `/favicon.ico` を返すまで。単なる TCP listen より厳しい「実際にアクセス可能」の値であり、アプリ route は warm-up しない。
3. `browserSetupAfterStaticReadyMs`: browser harness の起動コスト。SSR 値と分離して報告する。
4. `staticReadyToFirstSsrHeadersMs` / `staticReadyToFirstSsrHtmlMs`: static ready から、cold の `/config` SSR 応答まで。
5. `browserReadyToFirstSsrHeadersMs`: browser setup を除いた SSR 側の待機時間。
6. `firstSsrHtmlToInteractiveMs`: SSR HTML 受信から hydration 後の Settings の AI tab 操作成功まで。
7. `firstRpcRequestToResponseMs`: hydration 後に明示的に発火する短命 `config.get` RPC の request-to-response 時間。`/sources` の SSE は初回 RPC として数えない。
8. `rpcResponseFinishedToWorkerStartedMs` / `rpcResponseFinishedToMaintenanceStartedMs`: measurement profile 専用の server marker を基準にした worker / maintenance の開始時刻。`workerStartCount` と `maintenanceStartCount` はともに 1 を要求する。

2026-07-14 の cold run の代表値は次のとおり。単発値は採用判断の唯一の根拠にはせず、特に Devtools の有効／無効は複数回比較する。通常 dev の Devtools は既定で維持し、profile は寄与を調べるためだけに使う。

| profile          | static ready | static ready → SSR HTML | SSR HTML → interactive | navigation total | RPC |
| ---------------- | -----------: | ----------------------: | ---------------------: | ---------------: | --: |
| baseline         |        11347 |                    3481 |                   2240 |             5642 |  72 |
| without mkcert   |        11217 |                    3680 |                   2292 |             5878 |  51 |
| without Devtools |        11376 |                    3171 |                   1871 |             4944 |  61 |

通常 dev では TanStack Start だけを route tree と code splitting の owner とする。`@tanstack/router-plugin` を別に登録して同じ output を生成してはならない。dev oRPC middleware の server-only import は最初の RPC まで lazy にし、worker / maintenance は最初の 2xx RPC 応答完了後に一度だけ開始する。TanStack Start の server route graph は dev では `initServices` のみを行い、thumbnail や media body の request が二本目の worker を作らないようにする。SSR loader が必要とする `initServices` は router 側で維持する。

## E2E budget

`apps/server/src/tests/e2e/route-reload.spec.ts` を性能と重複通信の回帰条件の信頼できる情報源とする。時間 assertion はすべて上限未満を要求する。

直接アクセスの SSR 本文検査には、計測対象の `page.goto()` が返した response 本文をそのまま使う。事前の同一 URL request で route module や DB query を warm-up してから計測してはならない。

| ルート       | dev 直接 / reload | production 直接 / reload |
| ------------ | ----------------: | -----------------------: |
| Search       |    5000 / 2000 ms |           1500 / 1000 ms |
| Config       |    2500 / 2000 ms |           1500 / 1500 ms |
| Manager      |    3000 / 2000 ms |           1500 / 1500 ms |
| Sources      |    2500 / 2000 ms |           1500 / 1500 ms |
| Source Media |    3000 / 2000 ms |           1500 / 1000 ms |
| Media Detail |    4000 / 2000 ms |           1500 / 1000 ms |

共通 budget は次のとおり。

| 指標                       |     dev | production |
| -------------------------- | ------: | ---------: |
| TTFB                       | 1500 ms |    1000 ms |
| SPA 遷移から content ready | 3000 ms |    1500 ms |

budget を緩和する場合は、遅くなった endpoint と navigation 区間を artifact で特定し、実測根拠を Issue に残す。一時的な CI や開発マシン負荷だけを理由に閾値を引き上げない。

## 検証

レンダリング方式、loader、query key、bootstrap、route fallback を変更した場合は、少なくとも次を確認する。

1. dev と fresh production の両方で直接アクセス、F5、SPA 遷移が成功する。
2. SSR HTML に route 固有の内容があり、500、汎用 route error、`[object Object]` を含まない。
   Full data SSR は dehydrated JSON 内の文字列だけでなく、一覧 card や form control の実 DOM markup も確認する。
3. browser console に Hydration Mismatch がない。
4. hydrate 済み query と primary query が request budget を超えない。
   初回 hydration marker と route 固有 content ready を待ち、さらに 2 animation frame 待って、直後に発火する重複 request を計測へ含める。
5. TTFB、content ready、route 別 budget を満たす。
6. Full data SSR route は hydration 完了後に form、tab、dialog などの代表操作が成功する。

```bash
bun run --cwd apps/server test:e2e:dev -- route-reload.spec.ts
bun run --cwd apps/server test:e2e:production -- route-reload.spec.ts
```
