import { describe, expect, it, vi } from "vitest";
import { findValidInvite, markInviteUsed } from "./invite-repository.ts";
import type { PoolClient } from "pg";

function makeClient(rows: unknown[] = []) {
  return { query: vi.fn().mockResolvedValue({ rows }) } as unknown as PoolClient;
}

describe("findValidInvite", () => {
  it("returns an invite when a valid row exists", async () => {
    const row = {
      id: "inv-1",
      token: "tok",
      tenant_id: "t-1",
      role: "member",
      created_by: "p-1",
      expires_at: new Date("2030-01-01"),
    };
    const client = makeClient([row]);
    const result = await findValidInvite(client, "tok");
    expect(result).toEqual({
      id: "inv-1",
      token: "tok",
      tenantId: "t-1",
      role: "member",
      createdBy: "p-1",
      expiresAt: row.expires_at,
    });
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("FOR UPDATE"), ["tok"]);
  });

  it("returns null when no valid invite exists", async () => {
    const client = makeClient([]);
    const result = await findValidInvite(client, "bad-token");
    expect(result).toBeNull();
  });

  it("returns null tenantId for create-tenant invites", async () => {
    const row = {
      id: "inv-2",
      token: "tok2",
      tenant_id: null,
      role: "owner",
      created_by: "p-1",
      expires_at: new Date("2030-01-01"),
    };
    const client = makeClient([row]);
    const result = await findValidInvite(client, "tok2");
    expect(result?.tenantId).toBeNull();
  });
});

describe("markInviteUsed", () => {
  it("updates the invite with principal and timestamp", async () => {
    const client = makeClient();
    await markInviteUsed(client, "inv-1", "p-1");
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("UPDATE invites"), [
      "p-1",
      "inv-1",
    ]);
  });
});
