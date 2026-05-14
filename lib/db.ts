import mysql from "mysql2/promise";

const globalForDb = globalThis as typeof globalThis & {
  __dndPool?: mysql.Pool;
};

function buildPool() {
  console.log(`[Database] Attempting to connect to ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 3306}...`);
  const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "mydb",
    charset: 'utf8mb4',
    ssl: process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });

  // Test connection
  pool.getConnection().then((conn) => {
    console.log("[Database] Connected successfully to MySQL.");
    conn.release();
  }).catch((err) => {
    console.error("[Database] Connection failed:", err.message);
  });

  return pool;
}

export const db = globalForDb.__dndPool ?? buildPool();
if (process.env.NODE_ENV !== "production") globalForDb.__dndPool = db;

export default db;
