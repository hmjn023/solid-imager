# Quickstart: Effect.tsの導入を元に戻す

このクイックスタートガイドは、Effect.tsの導入を元に戻すための主要な手順を概説します。

## 1. ブランチのチェックアウト

まず、この機能の作業ブランチに切り替えます。

```bash
git checkout 009-effect-ts-effect
```

## 2. 依存関係のクリーンアップ

`package.json`からEffect.tsに関連する依存関係を削除し、`bun.lock`ファイルを更新します。

1.  `package.json`を編集し、`@effect/`で始まるすべての依存関係を`dependencies`および`devDependencies`セクションから削除します。
2.  以下のコマンドを実行して、依存関係を再インストールし、`bun.lock`を更新します。

    ```bash
    bun install
    ```

## 3. `tsconfig.json`の更新

`tsconfig.json`ファイルからEffect.tsに関連する型定義を削除します。`compilerOptions.types`または`compilerOptions.typeRoots`セクションを確認し、`@effect/`に関連するエントリがあれば削除します。

## 4. コードベースからのEffect.tsの削除

プロジェクト全体でEffect.tsのインポートと使用箇所を特定し、削除または置き換えます。

1.  以下のコマンドを使用して、Effect.tsのインポート箇所を検索します。

    ```bash
    grep -r "import.*Effect" src/
    ```

2.  検索結果に基づき、Effect.tsのAPIを使用しているコードを、Promise、try-catch、またはSolid.jsのリアクティブプリミティブなどの既存のパターンに置き換えるか、完全に削除します。

3.  Effect.tsに関連する設定ファイルやカスタムスクリプトがあれば削除します。

## 5. テストの修正と実行

Effect.tsに依存するテストを修正し、すべてのテストがパスすることを確認します。

1.  Effect.tsのAPIを使用しているテストファイルやテストケースを特定し、修正または削除します。
2.  以下のコマンドを実行して、すべてのテストがパスすることを確認します。

    ```bash
    bun run test
    ```

## 6. アプリケーションの検証

ロールバック後もアプリケーションが正常に動作することを確認します。

1.  開発サーバーを起動します。

    ```bash
    bun run dev
    ```

2.  ブラウザでアプリケーションにアクセスし、主要な機能（特にデータの永続化に関する機能）が期待通りに動作することを手動で確認します。

3.  プロダクションビルドが正常に作成されることを確認します。

    ```bash
    bun run build
    ```

    その後、プロダクションサーバーを起動して動作を確認します。

    ```bash
    bun run start
    ```

## 7. コード品質チェック

最後に、Biomeを使用してコードのフォーマットとリンティングを確認します。

```bash
bun run check
```

この手順を完了すると、Effect.tsがプロジェクトから完全に削除され、安定した状態に戻ります。