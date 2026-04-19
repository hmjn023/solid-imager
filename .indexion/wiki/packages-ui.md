# packages/ui

`@solid-imager/ui` — `apps/server` と `apps/tauri` が共有するUIコンポーネントライブラリ。[Kobalte](https://kobalte.dev/)（headless）をベースに、Tailwind CSSでスタイリング。solid-ui（shadcn/ui のSolidJSポート）アーキテクチャを採用。

## コンポーネント一覧

| コンポーネント | 説明 |
|---|---|
| `Button` | プライマリ・セカンダリ・アイコンボタン |
| `Input` | テキスト入力フィールド |
| `Textarea` | 複数行テキスト入力 |
| `Select` | ドロップダウン選択 |
| `Combobox` | 検索付きドロップダウン |
| `Checkbox` | チェックボックス |
| `Switch` | トグルスイッチ |
| `Badge` | ラベル・タグバッジ |
| `Card` | カードコンテナ |
| `Dialog` | モーダルダイアログ |
| `AlertDialog` | 確認ダイアログ |
| `Popover` | ポップオーバー |
| `ContextMenu` | 右クリックメニュー |
| `Tabs` | タブパネル |
| `Collapsible` | 折りたたみパネル |
| `Command` | コマンドパレット（cmdk形式） |
| `Progress` | プログレスバー |
| `Pagination Controls` | ページネーション |
| `Toast` | トースト通知 |
| `ClipboardCopy` | クリップボードコピーボタン |
| `Label` | フォームラベル |

## レイアウト

| コンポーネント | 説明 |
|---|---|
| `AppShell` | アプリケーション全体のシェルレイアウト（サイドバー+メインエリア） |

## ユーティリティ

| ファイル | 内容 |
|---|---|
| `utils/cn.ts` | `clsx` + `tailwind-merge` のラッパー（`cn()` 関数） |

## 使用方法

```typescript
import { Button } from "@solid-imager/ui/button";
import { Input } from "@solid-imager/ui/input";
import { cn } from "@solid-imager/ui/utils/cn";
```

## 開発ルール

- 新規コンポーネントはKobalteのheadlessプリミティブをベースにする
- スタイルはTailwind CSSクラスで記述し、`cn()` でマージ
- アプリ固有のロジックは含めない（純粋なUI部品のみ）
- `apps/server` と `apps/tauri` で共通化できるUI部品はここへ集約
