import { afterAll, beforeAll, describe, expect, it } from "vitest";
import pg from "pg";
import { findPrincipalByProviderIdentity } from "./identity-repository.ts";

const TEST_PRINCIPAL_ID = "a0000000-0000-0000-0000-000000000001";
const TEST_PROVIDER = "test-oidc";
const TEST_SUBJECT_ID = "test-subject-identity-repo";

let pool: pg.Pool;

beforeAll(async () => {
  pool = new pg.Pool({
    host: process.env.POSTGRES_HOST ?? "localhost",
    port: Number(process.env.POSTGRES_PORT ?? 5432),
    user: process.env.POSTGRES_USER ?? "heim",
    password: process.env.POSTGRES_PASSWORD ?? "heim",
    database: process.env.POSTGRES_DB ?? "heim",
  });

  await pool.query(`INSERT INTO principals (id, type) VALUES ($1, 'user') ON CONFLICT DO NOTHING`, [
    TEST_PRINCIPAL_ID,
  ]);
  await pool.query(
    `INSERT INTO identities (principal_id, provider, provider_subject_id)
     VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [TEST_PRINCIPAL_ID, TEST_PROVIDER, TEST_SUBJECT_ID],
  );
});

afterAll(async () => {
  await pool.query(`DELETE FROM identities WHERE provider = $1 AND provider_subject_id = $2`, [
    TEST_PROVIDER,
    TEST_SUBJECT_ID,
  ]);
  await pool.query(`DELETE FROM principals WHERE id = $1`, [TEST_PRINCIPAL_ID]);
  await pool.end();
});

describe("findPrincipalByProviderIdentity", () => {
  it("returns principalId for a known identity", async () => {
    const result = await findPrincipalByProviderIdentity(pool, TEST_PROVIDER, TEST_SUBJECT_ID);
    expect(result).toEqual({ principalId: TEST_PRINCIPAL_ID });
  });

  it("returns null for an unknown provider/subject pair", async () => {
    const result = await findPrincipalByProviderIdentity(pool, "unknown-provider", "unknown-sub");
    expect(result).toBeNull();
  });
});
