import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { LocalKeyManagementService } from "../crypto/kms.ts";
import { encryptPayload } from "../crypto/payload-encryption.ts";
import { makeClient } from "../test-helpers.ts";
import { loadTenantEvents } from "./load-tenant-events.ts";

const { publicKey, privateKey } = generateKeyPairSync("ml-kem-768");
const kms = new LocalKeyManagementService(publicKey, privateKey);

async function makeEncryptedPii(pii: Record<string, unknown>): Promise<{
  encryptedPayload: Buffer;
  encryptedKey: Buffer;
  mekVersion: number;
}> {
  const { plaintextDek, encryptedDek, mekVersion } = await kms.generateDek();
  const encryptedPayload = encryptPayload(Buffer.from(JSON.stringify(pii), "utf8"), plaintextDek);
  return { encryptedPayload, encryptedKey: encryptedDek, mekVersion };
}

function makeTenantEventRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "evt-1",
    tenant_id: "tenant-1",
    stream_id: "principal-1",
    stream_type: "User",
    stream_position: 1,
    global_position: "100",
    event_type: "UserCreated",
    correlation_id: "corr-1",
    causation_id: "command:corr-1",
    acting_principal_id: "principal-1",
    effective_principal_id: null,
    payload: { provider: "google", providerSubjectId: "sub-1", merged: false },
    metadata: {},
    actual_time: new Date("2026-01-15T12:00:00Z"),
    encrypted_payload: null,
    fp_principal_id: null,
    encrypted_key: null,
    mek_version: null,
    ...overrides,
  };
}

describe("loadTenantEvents", () => {
  it("returns empty array for tenant with no events", async () => {
    const client = makeClient();

    const events = await loadTenantEvents(client, kms, "tenant-1");

    expect(events).toEqual([]);
  });

  it("loads events with mixed encrypted and unencrypted payloads", async () => {
    const pii = { email: "alice@example.com", name: "Alice", avatarUrl: "https://img/a" };
    const { encryptedPayload, encryptedKey, mekVersion } = await makeEncryptedPii(pii);

    const client = makeClient();
    const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };

    query.mockResolvedValueOnce({
      rows: [
        makeTenantEventRow({
          encrypted_payload: encryptedPayload,
          fp_principal_id: "principal-1",
          encrypted_key: encryptedKey,
          mek_version: mekVersion,
        }),
        makeTenantEventRow({
          id: "evt-2",
          stream_id: "principal-2",
          stream_position: 1,
          global_position: "101",
          event_type: "UserCreated",
          encrypted_payload: null,
          fp_principal_id: null,
          encrypted_key: null,
          mek_version: null,
        }),
      ],
    });

    const events = await loadTenantEvents(client, kms, "tenant-1");

    expect(events).toHaveLength(2);
    expect(events[0]!.pii).toMatchObject(pii);
    expect(events[0]!.globalPosition).toBe("100");
    expect(events[1]!.pii).toBeUndefined();
    expect(events[1]!.globalPosition).toBe("101");
  });

  it("decrypts DEK only once per principal", async () => {
    const pii1 = { email: "alice@example.com", name: "Alice" };
    const pii2 = { email: "alice-updated@example.com", name: "Alice U" };

    const { plaintextDek, encryptedDek, mekVersion } = await kms.generateDek();
    const enc1 = encryptPayload(Buffer.from(JSON.stringify(pii1), "utf8"), plaintextDek);
    const enc2 = encryptPayload(Buffer.from(JSON.stringify(pii2), "utf8"), plaintextDek);

    const client = makeClient();
    const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };

    query.mockResolvedValueOnce({
      rows: [
        makeTenantEventRow({
          encrypted_payload: enc1,
          fp_principal_id: "principal-1",
          encrypted_key: encryptedDek,
          mek_version: mekVersion,
        }),
        makeTenantEventRow({
          id: "evt-2",
          stream_position: 2,
          global_position: "101",
          event_type: "UserCreated",
          encrypted_payload: enc2,
          fp_principal_id: "principal-1",
          encrypted_key: encryptedDek,
          mek_version: mekVersion,
        }),
      ],
    });

    const spy = vi.spyOn(kms, "decryptDek");

    const events = await loadTenantEvents(client, kms, "tenant-1");

    expect(events).toHaveLength(2);
    expect(events[0]!.pii).toMatchObject(pii1);
    expect(events[1]!.pii).toMatchObject(pii2);
    expect(spy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });

  it("handles crypto-shredded events (key missing)", async () => {
    const client = makeClient();
    const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };

    query.mockResolvedValueOnce({
      rows: [
        makeTenantEventRow({
          encrypted_payload: Buffer.from("some-encrypted-data"),
          fp_principal_id: "principal-1",
          encrypted_key: null,
          mek_version: null,
        }),
      ],
    });

    const events = await loadTenantEvents(client, kms, "tenant-1");

    expect(events).toHaveLength(1);
    expect(events[0]!.pii).toBeUndefined();
  });

  it("maps row fields to camelCase", async () => {
    const client = makeClient();
    const { query } = client as unknown as { query: ReturnType<typeof vi.fn> };

    query.mockResolvedValueOnce({ rows: [makeTenantEventRow()] });

    const events = await loadTenantEvents(client, kms, "tenant-1");

    const event = events[0]!;
    expect(event.tenantId).toBe("tenant-1");
    expect(event.streamId).toBe("principal-1");
    expect(event.streamType).toBe("User");
    expect(event.streamPosition).toBe(1);
    expect(event.globalPosition).toBe("100");
    expect(event.eventType).toBe("UserCreated");
    expect(event.correlationId).toBe("corr-1");
    expect(event.causationId).toBe("command:corr-1");
    expect(event.actingPrincipalId).toBe("principal-1");
    expect(event.effectivePrincipalId).toBeNull();
  });
});
