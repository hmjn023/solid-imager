import { config } from 'dotenv';
import path from 'path';

// .envファイルのパスを指定して読み込む
config({ path: path.resolve(process.cwd(), '.env') });
