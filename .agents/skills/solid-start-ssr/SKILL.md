---
name: solid-start-ssr
description: SolidStartとTanStack QueryにおけるSSR/CSR競合回避のベストプラクティス。フロントエンドのTSX/JSXファイルを扱う際に参照してください。
---

# SolidStart & TanStack Query SSR/CSR ベストプラクティス

SolidStartとTanStack Queryを組み合わせる際は、SSR（サーバー側）でのデータフェッチを活かしつつ、クライアント（ブラウザ）専用のAPIやDOM操作を正しく分離することが不可欠です。

## Working Rules

### 1. データフェッチはSSRをブロックしない

`createQuery` の `enabled` オプションに `!isServer` や `mounted()` を含めないでください。SSR時にデータが取得されない（`undefined` を返す）と、SolidStartのサスペンスが未解決のままとなり、無限ロードが発生します。

```tsx
// ❌ Bad Pattern: SSRをブロックすると無限ロードの原因になる
const query = createQuery(() => ({
  queryKey: ["items"],
  queryFn: fetchItems,
  enabled: !isServer, // 避けるべき
}));

// ✅ Good Pattern: サーバーでも実行させ、ハイドレーションをスムーズにする
const query = createQuery(() => ({
  queryKey: ["items"],
  queryFn: fetchItems,
}));
```

### 2. ブラウザ専用API・副作用のガード

`window`, `document`, `localStorage` などのブラウザ専用APIや、副作用（スクロール位置の操作など）は、必ず `isServer` でガードしてください。

```tsx
// ✅ Good Pattern: createEffect内でのガード
createEffect(() => {
  if (isServer) return;
  
  if (searchState.scrollY > 0) {
    window.scrollTo(0, searchState.scrollY);
  }
});

// ✅ Good Pattern: PortalなどのDOM依存コンポーネント
<Show when={!isServer}>
  <Portal mount={document.getElementById("nav-actions")!}>
    <MyClientOnlyComponent />
  </Portal>
</Show>
```

### 3. 非同期データを用いたフォームの初期化

`createForm` はデータが確実に存在した状態で初期化すべきです。`Show` を使って、データ取得後にフォームコンポーネントをマウントするパターンを推奨します。

```tsx
// ✅ Good Pattern
function ConfigForm(props: { data: AppConfig }) {
  const form = createForm(() => ({
    defaultValues: props.data,
    ...
  }));
  ...
}

export default function ConfigPage() {
  const configQuery = createQuery(...);
  
  return (
    <Show when={configQuery.data}>
      {(data) => <ConfigForm data={data()} />}
    </Show>
  );
}
```

### 4. 入力フィールドの `undefined` 回避

制御された入力（Controlled Input）に `undefined` を渡すと警告や不整合の原因になります。必ず空文字等へのフォールバックを行ってください。

```tsx
// ✅ Good Pattern
<Input 
  value={(field().state.value as string) ?? ""} 
/>
```

## Task Routing

| ユーザーの意図 | やること |
|---|---|
| データフェッチの問題 | `enabled` オプションに `!isServer` を含めていないか確認 |
| ブラウザAPI使用時のエラー | `isServer` ガードを追加 |
| フォーム初期化の問題 | `Show` でデータ取得後にマウント |
| 入力フィールドの警告 | `?? ""` でフォールバック |
