# Commit前の判断基準

対象は staged diff と変更後のリポジトリ。各項目を必ず評価し、変更・追加が不要な場合も理由と参照ファイルを示す。「確認済み」だけの判定は禁止する。

## architecture

変更後の責務、依存方向、パッケージ境界、公開API、実行構成が現在の説明と一致するかを確認する。

参照先:

- `AGENTS.md`
- `.agents/skills/solid-imager/SKILL.md`
- `docs/architecture/workspace-public-api.md`
- `docs/architecture/package-dependency-graph.md`
- 変更に関係する `docs/architecture/` の文書、各workspaceの `package.json`、実装

共有機能の移動、新しいworkspaceやport、依存方向、公開入口、サービス構成の変更について、説明の更新漏れと設計違反を探す。更新が必要な現在の説明が残っていれば NEEDS_CHANGE。単なるバグ修正、テスト、開発ツールの変更で現在の説明に影響がなければ、その根拠を示して PASS にできる。

日付・commit・調査時点を明記した過去の監査や実験記録を、現在の仕様書として書き換える必要はない。更新対象は現在の利用・設計を説明する文書とする。

## mcp

今回の機能をエージェントが利用する際、HTTP MCPまたはWebMCPの追加・更新が必要かを判断する。MCP関連ファイルが変更されていない場合も、この判断を省略しない。

参照先:

- `README.md` の「MCP からメディアを操作する」
- `apps/server/src/infrastructure/mcp/catalog.ts`
- `apps/server/src/infrastructure/mcp/http-handler.ts`
- `apps/server/src/infrastructure/mcp/web-tools.ts`
- `packages/core/src/domain/config/mcp.ts`
- `packages/core/src/domain/contract/`
- `packages/ui/src/` のWebMCP登録と画面操作、変更対象の実装・テスト

判断すること:

1. 新規・変更されたユーザー操作を、現在のツール・引数・戻り値でエージェントが実行できるか。
2. oRPC契約からの自動カタログ生成で既にカバーされるか。候補として登録されることと、初期状態で公開されることを区別する。
3. HTTPでのデータ操作だけで足りるか。画面遷移・選択・ジョブ表示などWebMCPの画面連携も必要か。
4. ツールの説明、schema、readOnlyの意味、公開設定、テスト、READMEに不整合がないか。
5. 設定API、イベント購読、ファイル・バイナリなど、既存方針で公開対象外の機能ではないか。

エージェントから利用すべき操作に経路がなく、今回の変更で対応が漏れていれば NEEDS_CHANGE。既存ツールや自動生成で十分、内部修正のみ、または意図的に公開しない場合は、具体的な根拠を示して PASS にできる。機能追加のたびに専用ツールや初期公開を機械的に要求しない。

## 判定と根拠

- `PASS`: 必要な対応が完了している、または追加対応が不要である理由を確認できた。
- `NEEDS_CHANGE`: 具体的な対応漏れ・不整合がある。`required_actions` に修正内容を書く。
- `UNKNOWN`: 重要な要件や判断材料が足りない。`required_actions` に必要な情報・判断を書く。推測だけで PASS にしない。
- `reason` は日本語で、今回の差分との関係を説明する。
- `evidence` はリポジトリ相対パスと、読んで確認した内容。変更後または変更前に存在するファイルを参照する。
- `PASS` の `required_actions` は空配列。他の判定では1件以上必須。
