---
name: tanstack-ssr
description: TanStack StartのSSR・hydration・loader・pending/root shellを診断・修正する。直接URL/F5だけの失敗、初期表示の問題で使用する。
---

# TanStack SSR

## 診断

- Context7で現行仕様を確認する。Reactの例をそのままSolidへ適用せず、必要ならインストール済みsolid-router/startのバージョンと `Match.js` / `Matches.js` のSSR分岐を読む。
- SPA遷移・直接URL・F5を分け、HTTP status、SSR HTML、console、hydration後DOMを比較する。
- routeと親routeの `ssr` / `loader` / `pendingComponent`、APIがHTTPかin-processか、service登録完了の順序を確認する。
- `Hydration Mismatch` やroute外error・`[object Object]` はまずDOM不一致を調べる。SSE/job完了やstale-vector問題は配信・query更新・DB状態を別に確認する。

## CSRを選ぶ場合

serverのQuery-heavy routeは原則CSR、Tauriは独立SPA。Query cacheをSSR統合していない画面、ブラウザ依存・Tauri共有画面ではCSRを優先する。

```ts
export const Route = createFileRoute("/example")({
  ssr: false,
  pendingComponent: () => null,
  component: ExamplePage,
});
```

- loaderの `ensureQueryData` を外し、取得を画面内Solid Queryへ集約する。
- `ssr: false` でもserverがpending fallbackを描画し得るため、空fallbackを明示する。
- AppShell・html・head・Scriptsはrootの `shellComponent` でSSRし、画面遷移中はroute transition indicatorを使う。

## データ込みSSRを選ぶ場合

SEO・初期表示性能で必要な場合に選ぶ。CSRのJS→API waterfallを改善するためにloaderだけを戻さない。

- loaderより前にservice bootstrapを完了させる。in-process oRPCは通常の `/api/rpc` handlerのbootstrapを通らない。
- `apps/server/src/router.tsx` の既存 `setupRouterSsrQueryIntegration({ router, queryClient })` でcacheを引き継ぐ。手動のdehydrate/hydrateを重ねず、query key・初期status・fallback DOMを一致させる。`ensureQueryData` だけでは不十分。

## 確認箇所

- Router/root: `apps/server/src/router.tsx`、`apps/server/src/routes/__root.tsx`
- Media detail: `apps/server/src/routes/sources/$mediaSourceId/$mediaId/index.tsx`
- Query/UI状態: `packages/ui/src/query-options/`、`packages/ui/src/query-state.ts`、`packages/ui/src/router-status.tsx`
- Server: `apps/server/src/infrastructure/bootstrap.ts`、`apps/server/src/infrastructure/api-clients/orpc-client.ts`

## 検証

router/root変更後はdev serverを再起動し、fresh production buildでも確認する。typecheck・Oxlint/Oxfmtと、`e2e-testing` の直接URL/F5検証を行う。

- responseが500未満で、CSRのSSR HTMLにroute pending DOMがない。
- hydration後とreload後に画面が表示され、Hydration Mismatch・汎用route errorがない。
- hydration後の初期queryが重複発火しない。

HTTP 200やHMRだけで合格にせず、errorComponentで不一致を隠さない。
