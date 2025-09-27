import path from "node:path";
import { config } from "dotenv";

// .envファイルのパスを指定して読み込む
config({ path: path.resolve(process.cwd(), ".env") });
