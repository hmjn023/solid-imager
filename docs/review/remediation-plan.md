# コードベース改善計画書

本ドキュメントは、コード監査によって判明した重要課題と、それに対する具体的な修正方針をまとめたものである。
プロジェクトの健全性、パフォーマンス、および保守性を確保するために、以下の修正を優先的に実施することを推奨する。

## 1. アーキテクチャの健全化 (重要度: 高)

### 現状の問題
ドメイン層 (`src/domain`) がインフラストラクチャ層のライブラリ (`sharp`) に直接依存しており、Clean Architectureの依存性ルールに違反している。

*   **違反箇所:** `src/domain/media/processing/image-processor.ts`

### 修正方針
**依存性逆転の原則 (DIP)** を適用し、ドメイン層を純粋な状態に戻す。

1.  **インターフェースの定義:**
    ドメイン層に `IImageProcessor` インターフェースを定義する。
    ```typescript
    // src/domain/media/processing/image-processor.interface.ts
    export interface IImageProcessor {
      extractMetadata(filePath: string): Promise<MediaMetadata>;
      // ...
    }
    ```
2.  **実装の分離:**
    インフラ層 (`src/infrastructure/processing/`) に `SharpImageProcessor` クラスを作成し、`sharp` を使用した実装を移動する。
3.  **依存性の注入:**
    ServiceやRepositoryは、具象クラスではなくインターフェースに依存するように変更する。

---

## 2. データベース・パフォーマンスの改善 (重要度: 緊急)

### 現状の問題
検索処理において、全件データをDBから取得した後にアプリケーション側でページネーションを行っている。データ量が増加するとメモリ枯渇によりサーバーがダウンする。

*   **問題箇所:** `src/infrastructure/db/queries/search.ts`

### 修正方針
SQLの機能を活用し、DB側でデータの絞り込みとソートを完結させる。

1.  **SQLページネーション:**
    `limit()` と `offset()` をクエリビルダに追加する。
    ```typescript
    // Bad
    const all = await query.execute();
    return all.slice(offset, offset + limit);

    // Good
    const paged = await query.limit(limit).offset(offset).execute();
    return paged;
    ```
2.  **SQLフィルタリング:**
    除外タグなどのフィルタリングロジックを、JavaScriptのループ処理から `NOT IN` や `LEFT JOIN` を用いたSQLクエリに変更する。
3.  **LIKEエスケープ:**
    ユーザー入力を用いた `like` 検索において、`%` や `_` をエスケープ処理するユーティリティを導入する。

---

## 3. ファイルシステム操作の安全性 (重要度: 高)

### 現状の問題
ディレクトリ走査処理において、再帰呼び出しの結果を Spread Syntax (`...`) で結合しているため、ファイル数が多いディレクトリでスタックオーバーフローが発生するリスクがある。

*   **問題箇所:** `src/infrastructure/repositories/media-repository.ts` の `scanDirectory`

### 修正方針
メモリ効率の良い反復処理に変更する。

1.  **ジェネレータの活用:**
    再帰的な配列結合をやめ、`for...of` ループや非同期ジェネレータを使用してファイルを1つずつ処理する、あるいは配列の `push` を使用する。
    ```typescript
    // Good approach example
    const files: string[] = [];
    async function scan(dir: string) {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) await scan(path.join(dir, entry.name));
        else files.push(path.join(dir, entry.name));
      }
    }
    ```

---

## 4. エラーハンドリングと堅牢性 (重要度: 中)

### 現状の問題
例外を `catch` ブロックで捕捉しながら何もせず無視（握りつぶし）している箇所が多数存在し、バグの発見を困難にしている。

*   **問題箇所:** `src/application/services/media-service.ts`

### 修正方針
1.  **握りつぶしの撤廃:**
    空の `catch` ブロックを削除する。どうしてもエラーを無視する必要がある場合は、必ず `console.warn` 等でログを出力し、その理由をコメントに残す。
2.  **Result型の導入検討:**
    例外スローの代わりに、成功/失敗を表すResult型 (`Promise<Result<T, E>>`) の導入を検討し、エラー処理を強制させる。

---

## 5. APIクライアントの環境非依存化 (重要度: 中)

### 現状の問題
APIクライアントで接続先 URL (`localhost:3000`) がハードコードされており、Docker環境やデプロイ環境で動作しない。

*   **問題箇所:** `src/infrastructure/api-clients/shared/base-client.ts`

### 修正方針
1.  **環境変数の利用:**
    `process.env.API_BASE_URL` などを参照するように変更する。
2.  **SolidStart RPCの活用:**
    可能な限り手書きの `fetch` ラッパーを廃止し、SolidStart の `server$` 関数 (RPC) に移行することで、クライアントとサーバーの通信ボイラープレートを削除する。

---

## 6. テスト戦略の見直し (重要度: 中)

### 現状の問題
ユニットテストが不足しており、結合テストもポーリング (`setTimeout`) に依存した不安定な実装となっている。

### 修正方針
1.  **Service層のユニットテスト:**
    DBやファイルシステムをモック化し、ビジネスロジック (Service) の単体テストを記述する。
2.  **結合テストの安定化:**
    `setTimeout` によるポーリングをやめ、イベント駆動または明示的なDB状態の監視によってテストの同期を取るヘルパー関数を作成する。
