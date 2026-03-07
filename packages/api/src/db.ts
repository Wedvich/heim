import pg from "pg";

export const pool = new pg.Pool({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  user: process.env.POSTGRES_USER ?? "heim",
  password: process.env.POSTGRES_PASSWORD ?? "heim",
  database: process.env.POSTGRES_DB ?? "heim",
});
