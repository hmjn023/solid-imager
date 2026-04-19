# Tauri対応: apps/tauri/src の SPA 設計方針

## 背景

`issue-169-tauri-build-bootstrap` ブランチで試みたTauri対応は失敗だった。
`apps/server` のルーティングツリーをそのまま流用し、`VITE_TAURI` ビルドフラグで
SSR/SPA を切り替える方式を採ったが、UI層全体に `isServer` / `isTauri` / `__TAURI_BUILD__`
の分岐コードが広がり、可読性・保守性ともに著しく低下した。

本ドキュメントは反省を踏まえた正しい設計方針を記録する。

---

## 失敗の根本原因

TanStack Start (SSR) と Tauri (SPA) は**ランタイムモデルが根本的に異なる**。

| 側面           | Web SSR (TanStack Start)         | Tauri SPA              |
| -------------- | -------------------------------- | ---------------------- |
| HTML生成       | Nitro がサーバー側でレンダリング | クライアントのみ       |
| ルーティング   | ファイルベース + Nitro           | クライアントサイドのみ |
| API通信        | 同一プロセス内 / ローカルホスト  | Tauriコマンド (IPC)    |
| サービス初期化 | Nitro 起動時                     | Tauri ウィンドウ起動時 |

この2つを同じルーティングツリー・同じ `apps/server/src` で混在させると、
`isServer` / `isTauri` チェックがコンポーネント・フック・ストア・ユーティリティ
全層に漏れ出す。これはパッチで直せない**設計レベルのミス**。

---

## 正しい設計: apps/tauri/src を独立 SPA として切り出す

### ディレクトリ構造

```
apps/
  server/               # 現状維持 (SSR/Nitro)
  tauri/
    src-tauri/          # Rust コード
    src/                # ← 独立 SPA (新設)
      routes/           # SPA ルーティングツリー
      infrastructure/
        tauri/          # IFileSystem, IMediaStorage 等の Tauri 実装
        api/            # Tauri コマンド経由の API クライアント
      bootstrap.ts      # SPA 用サービス初期化 (Nitro 依存なし)
    vite.config.ts      # Vite + SolidJS のみ
    index.html

packages/
  core/                 # ドメインロジック (isServer を持たない)
  ui/                   # 純クライアントサイド UI コンポーネント (isServer を除去)
```

### 境界の原則

- `packages/` は**プラットフォーム非依存**。`isServer` を持ってはいけない
- `apps/server/` は SSR/Nitro アプリ。`isServer` は許容
- `apps/tauri/src/` は SPA アプリ。`isServer` は不要、Tauri IPC を使う

---

## SPA スタック選定

### 選択肢

|                            | TanStack Start SPA mode | TanStack Router のみ | 素の SolidJS |
| -------------------------- | ----------------------- | -------------------- | ------------ |
| Nitro                      | **残る**                | 不要                 | 不要         |
| ファイルベースルーティング | あり                    | **あり**             | なし         |
| `createRouter` API         | 同一                    | **同一**             | 異なる       |
| `isServer` 不要            | △                       | **◎**                | ◎            |
| apps/server とのルート共用 | しやすい                | **しやすい**         | 難しい       |
| ビルド複雑度               | 高                      | **低**               | 最低         |

### 推奨: TanStack Router のみ (Start を外す)

TanStack Start の SPA モードは `tanstackStart()` プラグインと Nitro が
**ビルド時も残る**。設定上は `{ spa: { enabled: true } }` を渡すだけだが、
SSR スキャフォールドが消えるわけではなく曖昧な状態になる。

`@tanstack/solid-router` + `@tanstack/router-plugin/vite` を直接使う構成であれば:

- Nitro も `tanstackStart` も**一切不要**
- ファイルベースルーティング (`autoCodeSplitting: true`) はそのまま使える
- `createRouter` / `routeTree.gen.ts` の規約は `apps/server` と同一
  → ページコンポーネントを流用しやすい
- `isServer` が存在しない世界になる

### apps/tauri/vite.config.ts のイメージ

```ts
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import tailwindcss from "@tailwindcss/vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		tanstackRouter({ target: "solid", autoCodeSplitting: true }),
		solidPlugin(), // SSR 設定なし = 完全に SPA
		tailwindcss(),
		viteTsConfigPaths(),
	],
	// SSR セクションなし、tanstackStart() なし、nitro() なし
});
```

---

## レイアウト共通化

`apps/tauri/src` を独立させた場合、web と Tauri でレイアウトが乖離するリスクがある。
防止策は `packages/ui/src/layouts/` にレイアウト骨格を引き上げること。

```tsx
// packages/ui/src/layouts/app-shell.tsx
export function AppShell(props: {
	nav: JSX.Element; // リンクはアプリ側が渡す
	children: JSX.Element;
}) {
	return (
		<div class="flex h-screen">
			<aside>{props.nav}</aside>
			<main>{props.children}</main>
		</div>
	);
}
```

ルーター固有の `<Link>` / `<A>` はアプリ側で書き、レイアウト構造 (CSS・スタイル)
だけを共通化する。両アプリの `__root.tsx` が同じ `AppShell` を import することで
単一の真実の源を維持できる。

---

## プラットフォーム固有実装

```ts
// apps/tauri/src/infrastructure/tauri/file-system.ts
export class TauriFileSystem implements IFileSystem {
	async readFile(path: string) {
		return invoke("read_file", { path });
	}
}

// apps/server/src/infrastructure/node/file-system.ts
export class NodeFileSystem implements IFileSystem {
	async readFile(path: string) {
		return fs.readFile(path, "utf-8");
	}
}
```

インターフェースは `packages/core/src/interfaces/` に定義済み。
各アプリが自身のランタイムに合った実装を持つ。

---

## 実装手順

1. `apps/tauri/src/` を新設、上記 `vite.config.ts` を書く
2. `apps/tauri/src/routes/` に UI ページのみのルーティングツリーを作成
   - `apps/server/src/routes/api/` は含めない (Tauri は IPC 経由)
3. `apps/tauri/src/bootstrap.ts` で SPA 用サービス初期化 (Nitro 依存なし)
4. `apps/tauri/src/infrastructure/tauri/` に `IFileSystem` 等の Tauri 実装を置く
5. `packages/ui` から `isServer` を除去
6. `apps/server` から Tauri 分岐コードをすべて除去

---

## 検証

- `pnpm --filter tauri dev` で SPA 起動確認 (Vite dev server、Tauri はそれを wrap)
- `pnpm --filter server dev` で SSR 動作が壊れていないことを確認
- `grep -r "isServer" packages/` が 0 件になること

---

## 実装手順 (issue 分割)

親 issue: #165 / 旧失敗 issue: #168 (closed) #169 (方針転換でクローズ)

### Phase 1 — 境界を整える

- **#214** packages/ から isServer を除去
- **#215** packages/ui に AppShell レイアウト抽出

### Phase 2 — 独立 SPA の土台

- **#216** apps/tauri/src SPA スケルトン新設 (Vite + SolidJS + `@tanstack/solid-router`、`tanstackStart` / Nitro なし)
- **#217** Tauri プラットフォーム実装 (`IFileSystem` / `IImageProcessor` / API client)
- **#218** apps/tauri/src-tauri (Rust) — 旧 #169 の Rust 実装をサルベージ

### Phase 3 — ルート/画面の移植

- **#219** UI ページを apps/server から apps/tauri/src/routes へ移植

### Phase 4 — 検証

- **#220** Tauri for Linux 実機動作確認 (旧 #169 の本来の目的)

### 後続

- **#170** Tauri for Android スタンドアロン対応
