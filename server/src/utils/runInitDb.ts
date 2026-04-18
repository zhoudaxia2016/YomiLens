import { initDb } from "../db/schema.ts";

await initDb();
console.log("initDb done");
