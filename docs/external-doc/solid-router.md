# ルーティング

ルーティングは、Webアプリケーションの主要なコンポーネントとして機能します。SolidStartには、次の2つのタイプがあります。

*   UIルート — アプリのユーザーインターフェイスを定義します
*   APIルート — アプリのサーバーレス関数を定義します

APIルートの詳細については、APIルートのセクションを参照してください。

## 新しいルートの作成

SolidStartはファイルベースのルーティングを使用します。これは、プロジェクトにファイルとフォルダーを作成してルートを定義する方法です。これには、ページとAPIルートが含まれます。

SolidStartは、ルートディレクトリを走査し、すべてのルートを収集して、`<FileRoutes />` を使用してアクセスできるようにします。このコンポーネントにはUIルートのみが含まれ、APIルートは含まれません。ルーターコンポーネント内で各ルートを手動で定義するのではなく、`<FileRoutes />` はファイルシステムに基づいてルートを生成します。

`<FileRoutes />` はルーティング構成オブジェクトを返すため、選択したルーターで使用できます。この例では、solid-routerを使用します。

```typescript
import { Suspense } from "solid-js";
import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";

export default function App() {
  return (
    <Router root={(props) => <Suspense>{props.children}</Suspense>>}
      <FileRoutes />
    </Router>
  );
}
```

`<Router />` コンポーネントは、アプリ全体のルートレイアウトとして機能する `root` プロップを期待します。各コンポーネントは自動的に遅延ロードされるため、`props.children` が `<Suspense />` でラップされていることを確認する必要があります。これがないと、予期しないハイドレーションエラーが発生する可能性があります。

`<FileRoutes />` は、`routes` ディレクトリとそのサブディレクトリ内の各ファイルに対してルートを生成します。ページとしてレンダリングされるルートには、コンポーネントをデフォルトエクスポートする必要があります。このコンポーネントは、ユーザーがページにアクセスしたときにレンダリングされるコンテンツを表します。

```typescript
export default function Index() {
  return <div>Welcome to my site!</div>;
}
```

つまり、`routes` フォルダーにファイルを作成するだけで、SolidStartは、そのルートをアプリケーションで利用できるようにするために必要なその他すべてを処理します。

## ファイルベースのルーティング

`routes` ディレクトリ内の各ファイルはルートとして扱われます。アプリケーションに新しいルートまたはページを作成するには、`routes` ディレクトリに新しいファイルを作成するだけです。ファイル名は、ルートのURLパスになります。

*   `example.com/blog` ➜ `/routes/blog.tsx`
*   `example.com/contact` ➜ `/routes/contact.tsx`
*   `example.com/directions` ➜ `/routes/directions.tsx`

### ネストされたルート

ネストされたルートが必要な場合は、先行するルートセグメントの名前でディレクトリを作成し、そのディレクトリに新しいファイルを作成できます。

*   `example.com/blog/article-1` ➜ `/routes/blog/article-1.tsx`
*   `example.com/work/job-1` ➜ `/routes/work/job-1.tsx`

ファイル名が `index` の場合、一致するディレクトリに対して追加のURLルートセグメントが要求されていないときにレンダリングされます。

*   `example.com` ➜ `/routes/index.tsx`
*   `example.com/socials` ➜ `/routes/socials/index.tsx`

### ネストされたレイアウト

ネストされたレイアウトを作成する場合は、ルートフォルダーと同じ名前のファイルを作成できます。

```
|-- routes/
    |-- blog.tsx                   // レイアウトファイル
    |-- blog/
        |-- article-1.tsx         // example.com/blog/article-1
        |-- article-2.tsx        // example.com/blog/article-2
```

この場合、`blog.tsx` ファイルは `blog` フォルダー内の記事のレイアウトとして機能します。レイアウトで `props.children` を使用して子のコンテンツを参照できます。

```typescript
// routes/blog.tsx
import { RouteSectionProps } from "@solidjs/router";

export default function BlogLayout(props: RouteSectionProps) {
  return <div>{props.children}</div>;
}
```

**注:** `blog/index.tsx` または `blog/(blogIndex).tsx` を作成しても同じではありません。これらはインデックスルートにのみ使用されます。

### インデックスの名称変更

デフォルトでは、ルートにレンダリングされるコンポーネントは、各フォルダーの `index.tsx` ファイルのデフォルトエクスポートから取得されます。ただし、これにより、検索時に正しい `index.tsx` ファイルを見つけるのが難しくなる可能性があります。同じ名前のファイルが複数存在するためです。

これを回避するには、`index.tsx` ファイルを、それが存在するフォルダーの名前に括弧で囲んで変更できます。

これにより、そのルートのデフォルトエクスポートとして扱われます。

```
|-- routes/                       // example.com
    |-- blog/
        |-- article-1.tsx         // example.com/blog/article-1
        |-- article-2.tsx
    |-- work/
        |-- job-1.tsx             // example.com/work/job-1
        |-- job-2.tsx
    |-- socials/
        |-- (socials).tsx           // example.com/socials
```

### ネストされたルートのエスケープ

ネストされたパスがあり、別のレイアウトが必要な場合は、`()` で囲まれた名前を適用してネストされたルートをエスケープできます。これにより、前のルートの下にネストされていない新しいルートを作成できます。

```
|-- routes/
    |-- users/
        |-- index.tsx            // example.com/users
        |-- projects.tsx         // example.com/users/projects
    |-- users(details)/
        |-- [id].tsx            // example.com/users/1
```

さらに、独自のネストされたレイアウトを組み込むこともできます。

```
|-- routes/
    |-- users.tsx
    |-- users(details).tsx
    |-- users/
        |-- index.tsx
        |-- projects.tsx
    |-- users(details)/
        |-- [id].tsx
```

### 動的ルート

動的ルートは、ルートの1つのセグメントに対して任意の値を一致させることができるルートです。URLパスに動的セグメントが含まれている場合、角括弧 (`[]`) を使用して動的セグメントを定義します。

*   `example.com/users/:id` ➜ `/routes/users/[id].tsx`
*   `example.com/users/:id/:name` ➜ `/routes/users/[id]/[name].tsx`
*   `example.com/*missing` ➜ `/routes/[...missing].tsx`

これにより、URLパスのそのセグメントに対して任意の値を一致させることができる単一のルートを作成できます。たとえば、`/users/1` と `/users/2` は両方とも有効なルートであり、各ユーザーに対して個別のルートを定義するのではなく、動的ルートを使用して `id` セグメントの任意の値を一致させることができます。

```
|-- routes/
    |-- users/
        |-- [id].tsx
```

たとえば、solid-routerを使用すると、`useParams` プリミティブを使用して動的セグメントを一致させることができます。

```typescript
import { useParams } from "@solidjs/router";

export default function UserPage() {
  const params = useParams();
  return <div>User {params.id}</div>;
}
```

### オプションパラメータ

ルートにオプションパラメータがある場合は、二重角括弧 (`[[id]]`) を使用して動的セグメントを定義できます。これにより、パラメータの有無にかかわらずルートが一致します。

```
|-- routes/
    |-- users/
        |-- [[id]].tsx
```

この場合、一致する可能性のあるページには次のものがあります。

*   `/users`
*   `/users/1`
*   `/users/abc`

### キャッチオールルート

キャッチオールルートは、任意の数のセグメントを一致させることができる特殊なタイプの動的ルートです。これらは、ルートのラベルの前に `...` を付けた角括弧 (`[...post]`) を使用して定義されます。

```
|-- routes/
    |-- blog/
        |-- index.tsx
        |-- [...post].tsx
```

キャッチオールルートには、最後の有効なセグメントの後のすべてのURLセグメントのフォワードスラッシュ区切りの文字列である1つのパラメータがあります。たとえば、ルート `[...post]` とURLパス `/post/foo` の場合、`useParams` プリミティブから返される `params` オブジェクトには、値 `post/foo` の `post` プロパティがあります。URLパスが `/post/foo/baz` の場合、`post/foo/baz` になります。

```typescript
import { useParams } from "@solidjs/router";

export default function BlogPage() {
  const params = useParams();
  return <div>Blog {params.post}</div>;
}
```

### ルートグループ

ルートグループを使用すると、URL構造に影響を与えることなく、アプリケーションにとって意味のある方法でルートを整理できます。ファイルベースのルーティングはファイルシステムに基づいているため、アプリケーションにとって意味のある方法でルートを整理するのが難しい場合があります。

SolidStartでは、ルートグループはフォルダー名を括弧 (`()`) で囲むことで定義されます。

```
|-- routes/
    |-- (static)
        |-- about-us                // example.com/about-us
            |-- index.tsx
        |-- contact-us              // example.com/contact-us
            |-- index.tsx
```

### 追加のルート設定

SolidStartは、ファイルシステムの外で追加のルート設定を追加する方法を提供します。SolidStartは他のルーターの使用をサポートしているため、`<FileRoutes />` によって提供される `route` エクスポートを使用して、選択したルーターのルート設定を定義できます。

```typescript
import type { RouteSectionProps, RouteDefinition } from "@solidjs/router";

export const route = {
  preload() {
    // プリロード関数を定義
  }
} satisfies RouteDefinition

export default function UsersLayout(props: RouteSectionProps) {
  return (
    <div>
      <h1>Users</h1>
      {props.children}
    </div>
  );
}
```