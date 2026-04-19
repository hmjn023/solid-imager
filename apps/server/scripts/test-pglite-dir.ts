import { PGlite } from "@electric-sql/pglite";
import path from "path";

async function test() {
	const dataDir = path.join(process.cwd(), ".data", "test-pglite");
	console.log("Starting PGlite test with directory:", dataDir);
	try {
		const db = new PGlite(dataDir);
		await db.waitReady;
		const res = await db.query("SELECT 1 as one");
		console.log("Query result:", res);
		await db.close();
		console.log("PGlite test successful.");
	} catch (e) {
		console.error("PGlite test failed:", e);
	}
}

test();
