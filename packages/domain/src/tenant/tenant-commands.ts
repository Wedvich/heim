import type { Command } from "../commands.ts";

export interface RenameTenantPayload extends Readonly<Record<string, unknown>> {
  readonly newName: string;
}

export type TenantCommandPayload = {
  readonly type: "RenameTenant";
  readonly payload: RenameTenantPayload;
};

export type TenantCommand = Command & TenantCommandPayload;
