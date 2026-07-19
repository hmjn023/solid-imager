---
name: logging-rules
description: solid-imager プロジェクトにおけるロギング方針、Pino loggerの利用、アプリケーション・コア層でのILoggerインターフェースによる依存注入ルール、および console.log 禁止に関するガイドライン。
---

# solid-imager ロギング規約 (logging-rules)

このプロジェクトでは、サーバーサイドのロギングを統一し、構造化ログを活用するために **Pino** にロギングを統合しています。また、クリーンアーキテクチャの依存ルールを守るため、層ごとにロギングの方法が規定されています。

---

## 1. 基本ルール

- **`console.log`, `console.warn`, `console.error` の直接使用は原則禁止** (サーバーサイド・アプリケーション層)。
- ログは **構造化ログ** として出力する。
  - 第一引数: 関連データを含むオブジェクト (例: `{ err, mediaId }`)
  - 第二引数: ログメッセージ文字列

---

## 2. レイヤーごとのロギング実装方針

### 2.1. インフラ層・サーバー側エントリーポイント (`apps/server/src/infrastructure`, `apps/server/src/application`)

インフラ層は直接 Pino ロガーのインスタンスに依存して構いません。

- **使用方法**:

  ```typescript
  import { logger } from "~/infrastructure/logger";

  logger.info({ dbHost }, "[DB] Database connected");
  logger.error({ err }, "An error occurred");
  ```

### 2.2. アプリケーション層 (`packages/application/src`)

アプリケーション層はインフラ層 (`~/infrastructure/logger`) に直接依存してはいけません (依存ルール違反)。
代わりに `ILogger` ポートインターフェースを介した依存性注入 (Dependency Injection) を行います。

- **`ILogger` インターフェース定義** (`packages/application/src/ports/media-service.ts`):
  ```typescript
  export interface ILogger {
    info(obj: object, msg: string): void;
    error(obj: object, msg: string): void;
    warn(obj: object, msg: string): void;
  }
  ```
- **依存関係の定義**:

  ```typescript
  import type { ILogger } from "../ports/media-service";

  export type SomeServiceDeps = {
    logger?: ILogger;
    // ...
  };
  ```

- **ロギングの実装**:

  ```typescript
  export class SomeServiceImpl {
    private readonly logger?: ILogger;

    constructor(deps: SomeServiceDeps) {
      this.logger = deps.logger;
    }

    someMethod() {
      this.logger?.info({ data: 123 }, "Executing business logic");
    }
  }
  ```

- **インフラ層での注入** (`apps/server/src/infrastructure/bootstrap.ts`):
  インフラ層の Pino `logger` は `ILogger` のシグネチャと互換性があるため、そのままプロパティとして渡せます。
  ```typescript
  const someService = new SomeServiceImpl({
    logger, // pino logger
    // ...
  });
  ```

### 2.3. コア層・ドメイン層 (`packages/core/src`)

コア層はロガーに依存せず、ログ出力をしません。

- エラーは例外を投げるか、戻り値 (`{ ok: false, error: string }` 等) として呼び出し側に返し、ロギングはそれを受け取ったアプリケーション層やインフラ層で行います。

### 2.4. Isomorphic コード (サーバー・クライアント共有コード)

`router.tsx` など、SSR環境とブラウザ環境の両方でロードされるファイルでは、Node/Pino依存モジュールをトップレベルでインポートするとブラウザビルドでエラーになります。

- **`isServer` 条件下で動的インポート**を行ってロギングを呼び出します。

  ```typescript
  import { isServer } from "solid-js/web";

  if (isServer) {
    import("./infrastructure/logger").then(({ logger }) => {
      logger.info("[Router] Service initialized");
    });
  }
  ```

### 2.5. クライアントサイド (UI層・ブラウザ環境)

ブラウザでのみ動作するUIコンポーネントやカスタムフック内では、デバッグや警告のために通常の `console` メソッドを使用して構いません。

- **使用方法**:
  ```typescript
  console.warn("Media file loading timed out");
  ```
