import * as mariadb from "mariadb";

const globalForDb = globalThis as unknown as { pool: mariadb.Pool | undefined };

const pool =
  globalForDb.pool ??
  mariadb.createPool({
    host: process.env.DB_URL,
    user: process.env.DB_USER,
    password: process.env.PASSWORD,
    connectionLimit: 5,
    acquireTimeout: 30000,
    queryTimeout: 30000,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.pool = pool;
}

export async function getConnection() {
  return pool.getConnection();
}
