import { PGlite } from "@electric-sql/pglite";

async function test() {
	console.log("Starting PGlite test...");
	try {
		const db = new PGlite();
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
