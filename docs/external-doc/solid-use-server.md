# "use server"

"use server" は、サーバーでのみ実行される関数を有効にします。

```typescript
const logHello = async (message: string) => {
  "use server";
  console.log(message);
};
```
**注:** "use server" 関数は、asyncとしてマークするか、Promiseを返す必要があります。

## 基本的な使用法

"use server" を使用する場合、サーバーレンダリングが有効になっているかどうかに関係なく、それが適用される関数はサーバーでのみ実行されます。

これを行うには、コンパイルを使用して "use server" 関数をサーバーへのRPC呼び出しに変換します。

ファイルに "use server" が最初の行として挿入されている場合、ファイル全体がサーバー専用になります。

```typescript
"use server";

const logHello = async (message: string) => {
  console.log(message);
};
```
ただし、関数に "use server" が最初の行として挿入されている場合、その関数のみがサーバー専用になります。

```typescript
const logHello = async (message: string) => {
  "use server";
  console.log(message);
};

logHello("Hello");
```
どちらの例でも、`logHello` 関数は、レンダリングがサーバーで行われたかブラウザで行われたかに関係なく、サーバーコンソールにのみ表示されます。

## データAPIでの使用法

サーバー関数は、データのフェッチとサーバーでのアクションの実行に使用できます。次の例は、solid-routerのデータAPIと組み合わせてサーバー関数を使用する方法を示しています。

```typescript
const getUser = query((id) => {
  "use server";
  return db.getUser(id);
}, "users");

const updateUser = action(async (id, data) => {
  "use server"
  await db.setUser(id, data);
  throw redirect("/", { revalidate: getUser.keyFor(id) });
});
```
`getUser` または `updateUser` がクライアントで呼び出されると、サーバーにHTTPリクエストが行われ、対応するサーバー関数が呼び出されます。

## シングルフライトミューテーション

上記の例では、`updateUser` アクションが呼び出されると、サーバーでリダイレクトがスローされます。Solid Startは、クライアントに伝播する代わりに、サーバーでこのリダイレクトを処理できます。リダイレクトされたページのデータは、`updateUser` アクションと同じHTTPリクエストでクライアントにフェッチおよびストリーミングされ、クライアントがリダイレクトされたページに対して個別のHTTPリクエストを必要としません。

## シリアル化

サーバー関数は、Serovalシリアライザーを使用して、応答でさまざまなデータ型をシリアル化できます。完全なリストはSerovalのソースコードで入手できます。

## メタ情報

並列プロセスや複数のCPUコアまたはワーカーの場合でも、安定した関数固有の識別子を取得するには、`getServerFunctionMeta` を使用します。