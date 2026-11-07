import pg from "pg";
import { env } from "../config/env.js";

const { Pool } = pg;

let pool = null;

export function isDatabaseConfigured() {
  return Boolean(env.databaseUrl);
}

export function getPool() {
  if (!env.databaseUrl) {
    throw new Error("DATABASE_URL is not configured. Start PostgreSQL and set DATABASE_URL in backend/.env.");
  }
  if (!pool) {
    pool = new Pool({
      connectionString: env.databaseUrl,
      max: env.dbPoolMax,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });
    pool.on("error", (err) => console.error("PostgreSQL pool error:", err.message));
  }
  return pool;
}

export async function query(text, params = []) {
  return getPool().query(text, params);
}

export async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}
