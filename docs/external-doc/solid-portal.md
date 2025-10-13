# <Portal>

`<Portal>` は、親コンポーネントのDOM階層の外に存在するDOMノードに子をレンダリングできるコンポーネントです。

これは、モーダルやツールチップなど、UIに他のすべての要素の上に表示する必要がある要素がある場合に役立ちます。

```typescript
import { Portal } from "solid-js/web"
import type { JSX } from "solid-js"

function Portal(props: {
  mount?: Node
  useShadow?: boolean
  isSVG?: boolean
  children: JSX.Element
}): Text
```

これは要素をマウントノードに挿入します。ページレイアウトの外にモーダルを挿入するのに役立ちます。イベントはコンポーネント階層を介して伝播しますが、`<Portal>` はクライアントでのみ実行され、ハイドレーションは無効になっています。

ポータルは、ターゲットがドキュメントヘッドでない限り、`<div>` にマウントされます。`useShadow` はスタイル分離のために要素をシャドウルートに配置し、SVG要素に挿入する場合は `isSVG` が必要です。これにより、`<div>` が挿入されなくなります。

```typescript
<Portal mount={document.getElementById("modal")}>
  <div>My Content</div>
</Portal>
```

## プロパティ

| 名前      | 型      | デフォルト       | 説明                                     |
| :-------- | :-------- | :------------ | :---------------------------------------------- |
| `mount`     | `Node`    | `document.body` | ポータルをマウントするDOMノード。            |
| `useShadow` | `boolean` | `false`       | スタイル分離のためにシャドウルートを使用するかどうか。 |
| `isSVG`     | `boolean` | `false`       | マウントノードがSVG要素であるかどうか。       |