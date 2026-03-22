import { describe, expect, it } from "vitest";
import type { Command } from "../commands.ts";
import { tenantHandler } from "./tenant-handler.ts";
import type { TenantState } from "./tenant-state.ts";
import { INITIAL_TENANT_STATE } from "./tenant-state.ts";

const EXISTING_TENANT: TenantState = {
  tenantId: "tenant-1",
  name: "Acme",
  slug: "acme",
  createdAt: new Date("2026-01-15T10:00:00Z"),
  members: {
    "principal-1": { role: "owner", joinedAt: new Date("2026-01-15T10:00:00Z") },
  },
};

function makeCommand(
  type: string,
  payload: Record<string, unknown>,
  overrides?: Partial<Command>,
): Command {
  return {
    commandId: "cmd-1",
    correlationId: "corr-1",
    causationId: "caus-1",
    streamId: "tenant-1",
    streamType: "Tenant",
    type,
    payload,
    expectedVersion: 1,
    actualTime: new Date("2026-03-01T12:00:00Z"),
    tenantId: "tenant-1",
    actingPrincipalId: "principal-1",
    effectivePrincipalId: null,
    ...overrides,
  };
}

describe("tenantHandler", () => {
  describe("RenameTenant", () => {
    it("rejects when tenant does not exist", () => {
      const cmd = makeCommand("RenameTenant", { newName: "New Name" });
      const result = tenantHandler.handle(INITIAL_TENANT_STATE, cmd);

      expect(result).toEqual({ ok: false, reason: "Tenant does not exist" });
    });

    it("rejects empty name", () => {
      const cmd = makeCommand("RenameTenant", { newName: "" });
      const result = tenantHandler.handle(EXISTING_TENANT, cmd);

      expect(result).toEqual({ ok: false, reason: "Tenant name must not be empty" });
    });

    it("rejects whitespace-only name", () => {
      const cmd = makeCommand("RenameTenant", { newName: "   " });
      const result = tenantHandler.handle(EXISTING_TENANT, cmd);

      expect(result).toEqual({ ok: false, reason: "Tenant name must not be empty" });
    });

    it("rejects name exceeding 100 characters", () => {
      const cmd = makeCommand("RenameTenant", { newName: "a".repeat(101) });
      const result = tenantHandler.handle(EXISTING_TENANT, cmd);

      expect(result).toEqual({
        ok: false,
        reason: "Tenant name must not exceed 100 characters",
      });
    });

    it("no-ops when name is unchanged", () => {
      const cmd = makeCommand("RenameTenant", { newName: "Acme" });
      const result = tenantHandler.handle(EXISTING_TENANT, cmd);

      expect(result).toEqual({ ok: true, events: [] });
    });

    it("no-ops when trimmed name matches current name", () => {
      const cmd = makeCommand("RenameTenant", { newName: "  Acme  " });
      const result = tenantHandler.handle(EXISTING_TENANT, cmd);

      expect(result).toEqual({ ok: true, events: [] });
    });

    it("emits TenantRenamed with trimmed name", () => {
      const cmd = makeCommand("RenameTenant", { newName: "  New Acme  " });
      const result = tenantHandler.handle(EXISTING_TENANT, cmd);

      expect(result).toEqual({
        ok: true,
        events: [
          {
            eventType: "TenantRenamed",
            payload: { newName: "New Acme" },
          },
        ],
      });
    });

    it("accepts name at exactly 100 characters", () => {
      const name = "a".repeat(100);
      const cmd = makeCommand("RenameTenant", { newName: name });
      const result = tenantHandler.handle(EXISTING_TENANT, cmd);

      expect(result).toEqual({
        ok: true,
        events: [{ eventType: "TenantRenamed", payload: { newName: name } }],
      });
    });
  });

  it("rejects unknown command type", () => {
    const cmd = makeCommand("UnknownCommand", {});
    const result = tenantHandler.handle(EXISTING_TENANT, cmd);

    expect(result).toEqual({ ok: false, reason: "Unknown command type: UnknownCommand" });
  });
});
