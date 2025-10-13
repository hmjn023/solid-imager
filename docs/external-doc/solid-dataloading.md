# アプリケーションの構築

## データローディング

SolidStartは、データソースからデータをロードしてUIをデータで更新し続けることを容易にすることを目指しています。ほとんどのデータ要件では、どのデータをロードするかを決定するためにルートが使用される可能性が高いです。SolidStartには、アプリケーションのUIを階層的に構造化してレイアウトを共有できるようにするネストされたルーティングが含まれています。

### クライアントでのデータローディング

Solidは、`createResource`プリミティブを使用してデータソースからデータをロードする方法を提供します。これは非同期関数を受け取り、そこからシグナルを返します。`createResource`は`Suspense`および`ErrorBoundary`と統合されており、ライフサイクルとエラー状態の管理に役立ちます。

```typescript
// src/routes/users.tsx
import { For, createResource } from "solid-js";

type User = { name: string; house: string };

export default function Page() {
  const [users] = createResource(async () => {
    const response = await fetch("https://example.com/users");
    return (await response.json()) as User[];
  });

  return <For each={users()}>{(user) => <li>{user.name}</li>}</For>;
}
```

コンポーネント内でフェッチを行うと、特に遅延ロードされたセクションの下にネストされている場合、不要なウォーターフォールが発生する可能性があります。これを解決するには、データフェッチをコンポーネントツリーの最上位に持ち上げるか、SolidStartではサーバーを使用して非ブロッキング方式でデータをフェッチすることをお勧めします。以下の例では、solid-routerのAPIのデータを使用します。

solid-routerのいくつかの機能を使用して、データのキャッシュを作成できます。

```typescript
// /routes/users.tsx
import { For } from "solid-js";
import { createAsync, query } from "@solidjs/router";

type User = { name: string; email: string };

const getUsers = query(async () => {
  const response = await fetch("https://example.com/users");
  return (await response.json()) as User[];
}, "users");

export const route = {
  preload: () => getUsers(),
};

export default function Page() {
  const users = createAsync(() => getUsers());

  return <For each={users()}>{(user) => <li>{user.name}</li>}</For>;
}
```

ただし、この方法にはいくつかの注意点があります。

*   `preload`関数はルートごとに1回呼び出されます。これは、ユーザーがそのルートに初めてアクセスしたときです。その後、生き残っているきめ細かいリソースは、状態/URLの変更と同期して、必要に応じてデータを再フェッチします。データを更新する必要がある場合は、`createResource`で返される`refetch`関数を使用できます。
*   ルートがレンダリングされる前に、`preload`関数が呼び出されます。これはルートと同じコンテキストを共有しません。`preload`関数に公開されるコンテキストツリーは、Pageコンポーネントの上のすべてです。
*   サーバーとクライアントの両方で`preload`関数が呼び出されます。リソースは、サーバーレンダリングでデータをシリアル化した場合、再フェッチを回避できます。サーバー側のレンダリングは、リソースシグナルが`Suspense`境界の下でアクセスされた場合にのみ、リソースがフェッチしてシリアル化されるのを待ちます。

### 常にサーバーでデータをロードする

フルスタックJavaScriptフレームワークであることの利点は、サーバーとクライアントの両方で実行できるデータロードコードを簡単に記述できることです。SolidStartは、それ以上の機能を提供します。`"use server"`コメントを介して、バンドラーにRPCを作成し、クライアントバンドルにコードを含めないように指示できます。これにより、APIルートを作成する必要なく、サーバーでのみ実行されるコードを記述できます。たとえば、データベースアクセスや内部API、または関数内にいてサーバーを使用する必要がある場合などです。

```typescript
// /routes/users.tsx
import { For } from "solid-js";
import { createAsync, query } from "@solidjs/router";

type User = { name: string; email: string };

const getUsers = query(async () => {
  "use server";
  return store.users.list();
}, "users");

export const route = {
  preload: () => getUsers(),
};

export default function Page() {
  const users = createAsync(() => getUsers());

  return <For each={users()}>{(user) => <li>{user.name}</li>}</For>;
}
```

このページに関する問題を報告する