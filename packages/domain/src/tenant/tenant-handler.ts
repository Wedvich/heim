import type { Command, CommandHandler, DecisionResult } from "../commands.ts";
import type { TenantCommand } from "./tenant-commands.ts";
import type { TenantState } from "./tenant-state.ts";

const MAX_NAME_LENGTH = 100;

export const tenantHandler: CommandHandler<TenantState> = {
  streamType: "Tenant",

  handle(state: TenantState, command: Command): DecisionResult {
    const cmd = command as TenantCommand;

    switch (cmd.type) {
      case "RenameTenant": {
        // TODO: ABAC — require tenant:rename permission (owner role only)

        if (state.tenantId === null) {
          return { ok: false, reason: "Tenant does not exist" };
        }

        const trimmed = cmd.payload.newName.trim();

        if (trimmed.length === 0) {
          return { ok: false, reason: "Tenant name must not be empty" };
        }

        if (trimmed.length > MAX_NAME_LENGTH) {
          return {
            ok: false,
            reason: `Tenant name must not exceed ${MAX_NAME_LENGTH} characters`,
          };
        }

        if (trimmed === state.name) {
          return { ok: true, events: [] };
        }

        return {
          ok: true,
          events: [
            {
              eventType: "TenantRenamed",
              payload: { newName: trimmed },
            },
          ],
        };
      }

      default:
        return { ok: false, reason: `Unknown command type: ${(command as Command).type}` };
    }
  },
};
