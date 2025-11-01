# データモデル

このシステムのデータモデルは、Drizzle ORMを使用して `src/infrastructure/db/schema.ts` ファイルに定義されています。DB操作関数は、このスキーマから自動的に生成される型を利用して、型安全性を保証します。

## 主要なモデル

以下は、実装されるDB操作関数が主に対象とするテーブルと、それに対応するDrizzleの型です。

| テーブル名 | Select型 (読み取り) | Insert型 (書き込み) | 説明 |
| :--- | :--- | :--- | :--- |
| `mediaSources` | `MediaSource` | `NewMediaSource` | メディアが格納されている場所（ローカル、S3等）の情報。 |
| `medias` | `Media` | `NewMedia` | 画像や動画などの個々のメディアファイルの情報。 |
| `tags` | `Tag` | `NewTag` | メディアに付与されるタグの情報。 |
| `mediaTags` | `MediaTag` | `NewMediaTag` | メディアとタグの中間テーブル。 |
| `categories` | `Category` | `NewCategory` | メディアを分類するためのカテゴリ。 |
| `ips` | `Ip` | `NewIp` | 作品やシリーズなどの知的財産（IP）。 |
| `characters` | `Character` | `NewCharacter` | IPに関連するキャラクター。 |
| `mediaCharacters` | `MediaCharacter` | `NewMediaCharacter` | メディアとキャラクターの中間テーブル。 |
| `mediaDetails` | `MediaDetails` | `NewMediaDetails` | 評価やお気に入りなど、メディアの付加情報。 |
| `mediaGenerationInfo` | `MediaGenerationInfo` | `NewMediaGenerationInfo` | AI生成時のプロンプトやワークフローなどのメタデータ。 |

## 型の利用

DB操作関数は、これらの `Select` 型と `Insert` 型を引数や戻り値の型として使用します。これにより、不正なデータがデータベースに書き込まれるのを防ぎ、関数を利用する側も正しいデータ構造を扱うことができます。

**例:**
```typescript
import type { Media, NewMedia } from '~/infrastructure/db/schema';

// IDでメディアを1件取得する
async function selectMediaById(id: string): Promise<Media | undefined> { ... }

// 新しいメディアを登録する
async function insertMedia(data: NewMedia): Promise<Media> { ... }
```
