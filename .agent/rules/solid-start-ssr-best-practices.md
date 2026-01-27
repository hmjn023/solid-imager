---
trigger: glob
description: SolidStartとTanStack QueryにおけるSSR/CSR競合回避のベストプラクティス
globs: src/**/*.{tsx,jsx}
---

### SolidStart & TanStack Query SSR/CSR ベストプラクティス

SolidStartとTanStack Queryを組み合わせた場合、SSR（サーバーサイドレンダリング）とCSR（クライアントサイドレンダリング）の間で状態の不整合が起きやすく、無限ローディングやデータの消失につながることがあります。以下のパターンを遵守してください。

#### 1. データフェッチにおける `ClientOnly` パターンの回避

**問題:**
`mounted` シグナルや `ClientOnly` コンポーネントを使用して、クエリの実行をクライアントサイドのみに制限すると (`enabled: mounted()`)、ハイドレーション中にサスペンス状態が解決されず、ブラウザのロードスピナーが回り続ける無限ローディングが発生する場合があります。

**解決策:**
基本的にSSRを有効活用し、`mounted` によるガードを行わないでください。APIクライアント（`orpc`など）はSSR環境（localhost）とブラウザ環境（window.origin）の両方で動作するように設計されている必要があります。

```tsx
// ❌ Bad Pattern: 無限ロードの原因になる
const [mounted, setMounted] = createSignal(false);
const query = createQuery(() => ({
  queryKey: ["data"],
  queryFn: fetchData,
  enabled: mounted(), // Don't do this
}));

// ✅ Good Pattern: SSR/CSR両対応
const query = createQuery(() => ({
  queryKey: ["data"],
  queryFn: fetchData,
}));
```

#### 2. 非同期データを用いたフォームの初期化

**問題:**
`createForm` などのフォームライブラリを初期化する際、クエリデータがロード中（`undefined`）の状態で初期化してしまうと、初期値が空になり、データロード後に正しく反映されない（または一瞬表示されて消える）現象が発生します。

**解決策:**
データフェッチを行う親コンポーネント（Page）と、フォームを表示する子コンポーネント（Form）を分離し、データが確実に存在する場合のみフォームコンポーネントをマウントしてください。これにより、フォームは常に正しい初期値で生成されます。

```tsx
// ❌ Bad Pattern: データロード前の初期化による不整合
export default function Page() {
  const query = createQuery(...);
  // dataがundefinedの状態で初期化される
  const form = createForm({ defaultValues: query.data || {} });
  
  createEffect(() => {
    // 後からリセットしても競合する場合がある
    if (query.data) form.reset({ value: query.data });
  });
  ...
}

// ✅ Good Pattern: 完全なデータでのみ初期化
function FormComponent(props: { data: MyData }) {
  // props.dataは常に存在する
  const form = createForm({ defaultValues: props.data });
  ...
}

export default function Page() {
  const query = createQuery(...);
  
  return (
    <Show when={query.data}>
      {(data) => <FormComponent data={data()} />}
    </Show>
  );
}
```

#### 3. 入力フィールドの `undefined` 制御

**問題:**
フォームの状態が初期化前などで `undefined` になっている値を `<Input value={value} />` に渡すと、React/Solidは「制御されていない入力」と見なしたり、ブラウザが警告を出したりします。

**解決策:**
必ずフォールバック値（空文字など）を設定し、型アサーションや変換を行ってください。

```tsx
// ✅ Good Pattern
<Input 
  value={(field().state.value as string) ?? ""} 
/>
```