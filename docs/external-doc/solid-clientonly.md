# クライアント

## clientOnly

コンポーネントを `clientOnly` でラップすると、クライアントでのみレンダリングされます。これは、jQueryなどのDOMと直接対話するコンポーネントがサーバーでレンダリングできない場合に役立ちます。`lazy` と同様に機能しますが、ハイドレーション後にのみレンダリングされ、サーバーにロードされることはありません。

`clientOnly` を使用するには、DOM操作を含む目的のコンポーネントをファイルに分離します。

```typescript
const location = window.document.location;

export default function ClientOnlyComponent() {
  return <div>{location.href}</div>;
}
```

分離したら、`clientOnly` を使用して動的にインポートできます。

```typescript
import { clientOnly } from "@solidjs/start";

const ClientOnlyComp = clientOnly(() => import("../ClientOnlyComp"));

function IsomorphicComp() {
  return <ClientOnlyComp />;
}
```

**注:** `<ClientOnlyComp />` は、ロード中に `fallback` プロップを受け取ることができます。

## パラメータ

| 引数 | 型          | 説明                  |
| :------- | :------------ | :--------------------------- |
| `fn`     | `() => Promise` | クライアント側でのみ実行される関数。 |