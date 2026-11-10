---
name: logging-rules
description: Pino・ILoggerの層別ルール。ログの実装・変更・整理時に使用する。
---

# Logging

ログは `logger.info({ mediaId }, "message")` のようにデータを第一引数、メッセージを第二引数へ渡す。

| 層 | ログ出力 |
| --- | --- |
| server infrastructure | `~/infrastructure/logger` のPinoを直接利用 |
| `packages/application` | `ILogger` を依存注入。server loggerを直接importしない |
| `packages/core` | 出力しない。エラーを呼び出し元へ返す |
| ブラウザ専用UI | `console` を利用可能 |

- server・applicationで `console.log/warn/error` を直接使わない。
- `ILogger` の定義は `packages/application/src/ports/logger.ts`。serverからのimportは `@solid-imager/application/logging` を使い、bootstrapでPinoを注入する。
- SSRとブラウザで共有するコードでは、Pinoをトップレベルimportしない。`isServer` 条件下の動的importを使う。
