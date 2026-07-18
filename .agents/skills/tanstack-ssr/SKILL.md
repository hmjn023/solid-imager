---
name: tanstack-ssr
description: solid-imagerのTanStack Start SSR、Selective SSR、loader、Solid Query hydration、直接URL/F5、pendingComponent、shellComponentを診断・修正する。Hydration Mismatch、ルート外error、SSRだけのAPI失敗、CSR化後のローディングDOM不一致、初期表示性能を扱う時に使用する。
---

# TanStack SSR

TanStack Startのサーバー実行経路とクライアントhydrationを分けて調べ、F5とSPA遷移の両方で同じ画面状態になるよう修正する。

## 事前調査

TanStack Startは変更が速いため、実装前にContext7で現行仕様を確認する。

```sh
ctx7 library tanstack-start "Selective SSR hydration loader pendingComponent Solid"
ctx7 docs /websites/tanstack_start "ssr false pendingComponent hydration loader shellComponent"
```

React向けドキュメントしか見つからない場合は、そのままSolidへ適用しない。インストール済みの`@tanstack/solid-router`と`@tanstack/solid-start`のバージョン、および`Match.js`/`Matches.js`のSelective SSR分岐も確認する。

## 診断手順

1. SPA内遷移、URL直入力、F5を分けて再現する。
2. HTTP statusだけでなく、SSR HTML、ブラウザconsole、hydration後DOMを確認する。
3. 対象routeの`ssr`、`loader`、`pendingComponent`、親routeを確認する。
4. loaderが呼ぶAPIがHTTP経由か、in-process router client経由かを確認する。
5. server loaderの実行前にrepository/service登録が完了しているか確認する。
6. サーバーが出したDOMと、クライアント初回renderのDOMを比較する。

次のログはAPI障害ではなく、まずDOM不一致として扱う。

```text
Hydration Mismatch. Unable to find DOM nodes for hydration key
The following error wasn't caught by any route
[object Object]
```

## 修正方針を選ぶ

### Query-heavy routeをCSRにする

SSR Query cacheをdehydrate/hydrateしていない画面、ブラウザ依存APIを使う画面、Tauriと共有する画面ではこちらを優先する。

```ts
export const Route = createFileRoute("/example")({
  ssr: false,
  pendingComponent: () => null,
  component: ExamplePage,
});
```

- server loaderの`ensureQueryData`を削除する。
- データ取得は画面内のSolid Queryへ一本化する。
- `ssr: false`ではサーバーがpending fallbackを描画し得るため、route単位で空のfallbackを明示する。
- AppShell、`html`、`head`、`Scripts`はrootの`shellComponent`でSSRする。
- クライアント画面遷移のローディング表示はroute transition indicatorで提供する。

CSRは`HTML → JS → API → render`のwaterfallになる。mainより初期表示が遅くなる場合、単純にloaderを戻さず、下記のSSR Query統合を検討する。

### データ込みSSRを維持する

SEOまたは初期表示性能のために必要な場合だけ選ぶ。

- loader開始前にserver service bootstrapを確実に完了させる。
- in-process oRPCは通常の`/api/rpc` handlerの`bootstrap()`を通らないことに注意する。
- server QueryClientのcacheをdehydrateし、同じcacheをclientでhydrateする。
- serverとclientでquery key、initial status、fallback DOMを一致させる。
- `ensureQueryData`だけ追加してSSR Query統合を省略しない。

## solid-imager固有の確認箇所

- Router設定: `apps/server/src/router.tsx`
- Root shell: `apps/server/src/routes/__root.tsx`
- Media detail route: `apps/server/src/routes/sources/$mediaSourceId/$mediaId/index.tsx`
- Query設定: `packages/ui/src/query-options/`
- Query画面状態: `packages/ui/src/query-state.ts`
- Route pending/error UI: `packages/ui/src/router-status.tsx`
- Server bootstrap: `apps/server/src/infrastructure/bootstrap.ts`
- Isomorphic oRPC client: `apps/server/src/infrastructure/api-clients/orpc-client.ts`

このプロジェクトではserverのQuery-heavy routeを原則CSRとし、Tauriは独立SPAとして扱う。SSRを再導入する場合は、対象routeだけでなくQuery cache hydrationとbootstrap順序まで設計する。

## 禁止パターン

- 非同期bootstrapを待たずにSSR loaderからin-process APIを呼ぶ。
- server Query cacheをclientへ渡さず`ensureQueryData`だけ使う。
- `ssr: false`でサーバー側pending DOMを無条件に描画する。
- `errorComponent`でHydration Mismatchを隠して完了とする。
- HTTP 200だけでSSR回帰テストを合格させる。
- router/root変更をdev serverのHMRだけで検証する。
- SSR問題とSSE/job完了通知の問題を同じ原因として扱う。

## 検証

production build後のserverで検証する。router/rootを変更した場合はdev serverも再起動する。

E2Eでは最低限次を確認する。

1. URL直入力のresponseが500未満である。
2. CSR routeのSSR HTMLにroute pending DOMが含まれない。
3. consoleに`Hydration Mismatch`が出ない。
4. hydration後に汎用route error画面が出ない。
5. `page.reload()`後も同じ結果になる。
6. 初期queryがhydration後に重複発火しない。

```ts
const hydrationWarnings: string[] = [];
page.on("console", (message) => {
  if (message.text().includes("Hydration Mismatch")) {
    hydrationWarnings.push(message.text());
  }
});

const ssrResponse = await page.request.get(path);
expect(await ssrResponse.text()).not.toContain("画面を読み込んでいます...");
await page.goto(path);
await page.reload();
expect(hydrationWarnings).toHaveLength(0);
```

最後に対象appのtypecheck、Biome、production build、直接アクセスを含むE2Eを実行する。
