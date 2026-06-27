---
name: orpc-api
description: oRPC API の contract、router、Zod schema、Safe DTO、OpenAPI 更新を扱う際に使用する。'packages/core/src/domain/contract/'、'apps/server/src/infrastructure/api/routers/'、または API クライアント呼び出しを変更する時に参照する。
---

# oRPC API Development Skill

このプロジェクトでは oRPC を API 境界に使います。目的は「入力/出力 schema、router 実装、クライアント型、OpenAPI」を同じ契約から追える状態に保つことです。

## 現在の配置

- Contract: `packages/core/src/domain/contract/*.contract.ts`
- Contract 集約: `packages/core/src/domain/contract/index.ts`
- Server router: `apps/server/src/infrastructure/api/routers/*-router.ts`
- Server router 集約: `apps/server/src/domain/shared/api-contract.ts`
- Client: `packages/client` と各 app の `infrastructure/api-clients/`
- OpenAPI 出力: `apps/server/public/openapi.json`

## 変更手順

1. 入出力に必要な Zod schema を `packages/core/src/domain/{entity}/schemas.ts` へ置く。
2. API 境界を `packages/core/src/domain/contract/{entity}.contract.ts` に追加・変更する。
3. server 実装を `apps/server/src/infrastructure/api/routers/{entity}-router.ts` に追加・変更する。
4. 新しい router/contract を追加した場合は、対応する `index.ts` / `api-contract.ts` の集約へ登録する。
5. レスポンスに機密情報が入り得る場合は `safe-dto` スキルの方針で Safe DTO へマッピングする。
6. API 仕様が変わった場合は `api-docs` スキルも参照し、OpenAPI を再生成する。

## 実装判断

- Router は HTTP/RPC の薄い入口に寄せる。認可、DB 操作、ファイル操作、ジョブ投入などのまとまった処理は application/service 側へ逃がすとテストと再利用がしやすい。
- 入力 schema は contract と router で意味がずれないよう、共通 schema を参照する。router 内で一回限りの schema を直接書く場合は、その API だけの transport 形状かどうかを確認する。
- oRPC は JSON 境界なので、画像・動画などのバイナリ本体は専用 REST route や URL 返却を優先する。Base64 返却はサイズ増とメモリ使用量が大きくなりやすい。
- エラーは `packages/core/src/domain/errors/` の既存エラーを優先する。呼び出し側がリカバリできる情報を型・code・message に残す。

## 確認

- API 型変更: `bun run typecheck`
- server 周辺: `bun --filter @solid-imager/server run typecheck`
- OpenAPI 変更: `bun --filter @solid-imager/server run gen:spec`
- router の振る舞い: 既存の `apps/server/src/tests/api/` または関連する unit/integration test に合わせて追加する。
