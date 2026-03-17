import { randomBytes } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import type { KeyManagementService } from "../crypto/kms.ts";
import { encryptPayload } from "../crypto/payload-encryption.ts";
import { makeClient } from "../test-helpers.ts";
import { loadHydratedUserStream } from "./load-user-stream.ts";

const DEK = randomBytes(32);

function makeKms(dek: Buffer = DEK): KeyManagementService {
  return {
    generateDek: vi.fn(),
    decryptDek: vi.fn().mockResolvedValue(dek),
  };
}

function makeEventRow(overrides?: Partial<Record<string, unknown>>) {
  return {
    id: "evt-1",
    tenant_id: "tenant-1",
    stream_id: "principal-1",
    stream_type: "User",
    stream_position: 1,
    event_type: "UserCreated",
    correlation_id: "corr-1",
    causation_id: "command:corr-1",
    acting_principal_id: "principal-1",
    effective_principal_id: null,
    payload: { provider: "google", providerSubjectId: "sub-1", merged: false },
    metadata: {},
    actual_time: new Date("2026-01-15T12:00:00Z"),
    encrypted_payload: null,
    ...overrides,
  };
}

function encryptPii(pii: Record<string, unknown>, dek: Buffer = DEK): Buffer {
  return encryptPayload(Buffer.from(JSON.stringify(pii), "utf8"), dek);
}

describe("loadHydratedUserStream", () => {
  it("returns hydrated events with decrypted PII", async () => {
    const pii = { email: "alice@example.com", name: "Alice", avatarUrl: "https://img/a" };
    const client = makeClient();
    const kms = makeKms();
    const mockQuery = vi.mocked(client.query);

    // First call: events query
    mockQuery.mockResolvedValueOnce({
      rows: [makeEventRow({ encrypted_payload: encryptPii(pii) })],
    } as never);
    // Second call: forgettable_payload_keys query
    mockQuery.mockResolvedValueOnce({
      rows: [{ encrypted_key: Buffer.from("encrypted-dek"), mek_version: 1 }],
    } as never);

    const result = await loadHydratedUserStream(client, kms, "tenant-1", "principal-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.pii).toEqual(pii);
    expect(result[0]!.eventType).toBe("UserCreated");
    expect(result[0]!.tenantId).toBe("tenant-1");
    expect(kms.decryptDek).toHaveBeenCalledWith(Buffer.from("encrypted-dek"), 1);
  });

  it("returns events without PII when DEK is missing (crypto-shredded)", async () => {
    const client = makeClient();
    const kms = makeKms();
    const mockQuery = vi.mocked(client.query);

    mockQuery.mockResolvedValueOnce({
      rows: [makeEventRow({ encrypted_payload: encryptPii({ email: "gone@example.com" }) })],
    } as never);
    // No key record
    mockQuery.mockResolvedValueOnce({ rows: [] } as never);

    const result = await loadHydratedUserStream(client, kms, "tenant-1", "principal-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.pii).toBeUndefined();
    expect(kms.decryptDek).not.toHaveBeenCalled();
  });

  it("returns events without PII when forgettable payload is NULL", async () => {
    const client = makeClient();
    const kms = makeKms();
    const mockQuery = vi.mocked(client.query);

    mockQuery.mockResolvedValueOnce({
      rows: [makeEventRow({ encrypted_payload: null })],
    } as never);
    mockQuery.mockResolvedValueOnce({
      rows: [{ encrypted_key: Buffer.from("encrypted-dek"), mek_version: 1 }],
    } as never);

    const result = await loadHydratedUserStream(client, kms, "tenant-1", "principal-1");

    expect(result).toHaveLength(1);
    expect(result[0]!.pii).toBeUndefined();
  });

  it("returns empty array when no events exist", async () => {
    const client = makeClient();
    const kms = makeKms();

    const result = await loadHydratedUserStream(client, kms, "tenant-1", "principal-1");

    expect(result).toEqual([]);
    expect(kms.decryptDek).not.toHaveBeenCalled();
  });
});
