export type ApplyFn<TState, TEvent> = (state: TState, event: TEvent) => TState;

export interface Aggregate<TState> {
  readonly state: TState;
  readonly version: number;
}

export function buildAggregate<TState, TEvent extends { readonly streamPosition: number }>(
  initial: TState,
  events: readonly TEvent[],
  apply: ApplyFn<TState, TEvent>,
): Aggregate<TState> {
  let state = initial;
  let version = 0;

  for (const event of events) {
    state = apply(state, event);
    version = event.streamPosition;
  }

  return { state, version };
}
