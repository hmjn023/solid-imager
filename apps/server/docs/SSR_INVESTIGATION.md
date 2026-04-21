# TanStack Start SSR 調査報告

## 1. 現状の SSR 実装
現在のプロジェクトでは、TanStack Start (SolidJS) をベースに、Vinxi と Nitro を用いた SSR 構造が構築されています。

- **SSR の有効化**: 各ルート（`src/routes/` 内の `sources/index.tsx`, `search.tsx` 等）で `ssr: true` が設定されています。
- **データ取得**: ルートの `loader` 内で `context.queryClient.ensureQueryData` を呼び出し、レンダリング前にデータをフェッチしています。
- **oRPC 統合**: `createIsomorphicFn` により、サーバーサイドでは API ルーターを直接呼び出し、クライアントサイドでは HTTP 経由で呼び出すように最適化されています。

## 2. 特定された課題
調査の結果、以下の重要な課題が特定されました。

- **状態同期（Dehydration/Hydration）の不備**:
  サーバー側で取得した `QueryClient` のキャッシュ状態をクライアントに引き継ぐ処理が実装されていません。
  - **影響**: サーバー側でフェッチが完了していても、クライアント側でのハイドレーション直後にすべてのデータが再フェッチ（二重フェッチ）されています。
- **`@tanstack/solid-router-ssr-query` の未活用**:
  `package.json` には存在しますが、コード内での実装が確認できません。

## 3. 推奨される最適化
- **Dehydration の実装**: `@tanstack/solid-router-ssr-query` を使用して、サーバー側の状態を HTML に埋め込み、クライアントで復元するように修正。
- **`useSuspenseQuery` への移行**: ストリーミング SSR の恩恵を最大化するため、`createQuery` から `useSuspenseQuery` への移行を推奨します。
