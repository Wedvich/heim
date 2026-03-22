import type { DomainEvent } from "./events.ts";

export interface Command {
  readonly commandId: string;
  readonly correlationId: string;
  readonly causationId: string;
  readonly streamId: string;
  readonly streamType: string;
  readonly type: string;
  readonly payload: Readonly<Record<string, unknown>>;
  readonly expectedVersion: number;
  readonly actualTime: Date;
  readonly tenantId: string;
}

export type CommandResult =
  | { readonly ok: true; readonly events: readonly DomainEvent[] }
  | { readonly ok: false; readonly reason: string };

export interface CommandHandler<TState = unknown> {
  readonly streamType: string;
  handle(state: TState, command: Command): CommandResult;
}

export class CommandHandlerRegistry {
  #handlers = new Map<string, CommandHandler>();

  register(handler: CommandHandler): this {
    if (this.#handlers.has(handler.streamType)) {
      throw new Error(`Handler already registered for stream type: ${handler.streamType}`);
    }
    this.#handlers.set(handler.streamType, handler);
    return this;
  }

  handle(state: unknown, command: Command): CommandResult {
    const handler = this.#handlers.get(command.streamType);
    if (!handler) {
      return {
        ok: false,
        reason: `No handler for stream type: ${command.streamType}`,
      };
    }
    return handler.handle(state, command);
  }
}
