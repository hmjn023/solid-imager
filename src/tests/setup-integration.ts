import path from "node:path";
import { config } from "dotenv";

// .envファイルのパスを指定して読み込む
// 統合テストでは実際のデータベースを使用するため、モックは適用しない
config({ path: path.resolve(process.cwd(), ".env") });

// テスト用のDB接続情報が設定されていない場合はデフォルト値を設定
if (!process.env.DB_HOST) {
  process.env.DB_HOST = "localhost";
  process.env.DB_PORT = "5432";
  process.env.DB_DATABASE = "solid_imager_test";
  process.env.DB_USER = "test";
  process.env.DB_PASSWORD = "test";
}
