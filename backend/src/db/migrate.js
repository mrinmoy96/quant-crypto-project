import "dotenv/config";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { query, closePool } from "./pool.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.resolve(__dirname, "../../migrations");

async function migrate() {
  await query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id SERIAL PRIMARY KEY,
      filename TEXT NOT NULL UNIQUE,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const filename of files) {
    const existing = await query("SELECT 1 FROM schema_migrations WHERE filename = $1", [filename]);
    if (existing.rowCount) {
      console.log(`✓ already applied ${filename}`);
      continue;
    }

    const sql = await fs.readFile(path.join(migrationsDir, filename), "utf8");
    const client = await (await import("./pool.js")).getPool().connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (filename) VALUES ($1)", [filename]);
      await client.query("COMMIT");
      console.log(`✓ applied ${filename}`);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
}

migrate()
  .then(async () => {
    console.log("PostgreSQL migrations complete.");
    await closePool();
  })
  .catch(async (err) => {
    console.error("Migration failed:", err.message);
    await closePool().catch(() => {});
    process.exitCode = 1;
  });
