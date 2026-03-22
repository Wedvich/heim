import { makeObservable, observable, runInAction } from "mobx";
import type { DomainEvent } from "@heim/domain";

export abstract class Model<TState, TEvent extends DomainEvent> {
  readonly streamId: string;
  readonly streamType: string;
  protected _state: TState;
  #version: number;
  #confirmedState: TState;
  #confirmedVersion: number;

  constructor(
    streamId: string,
    streamType: string,
    initialState: TState,
    initialVersion: number = 0,
  ) {
    this.streamId = streamId;
    this.streamType = streamType;
    this._state = initialState;
    this.#version = initialVersion;
    this.#confirmedState = initialState;
    this.#confirmedVersion = initialVersion;

    makeObservable<Model<TState, TEvent>, "_state">(this, {
      _state: observable.ref,
    });
  }

  protected abstract fold(state: TState, event: TEvent): TState;

  get state(): TState {
    return this._state;
  }

  get version(): number {
    return this.#version;
  }

  get confirmedVersion(): number {
    return this.#confirmedVersion;
  }

  applyEvent(event: TEvent): void {
    runInAction(() => {
      this._state = this.fold(this._state, event);
      this.#version = event.streamPosition;
    });
  }

  /** Advance the confirmed baseline (e.g. after authoritative events arrive). */
  advanceConfirmed(events: readonly TEvent[]): void {
    for (const event of events) {
      this.#confirmedState = this.fold(this.#confirmedState, event);
      this.#confirmedVersion = event.streamPosition;
    }
  }

  /** Reset to confirmed state, then replay the given speculative events. */
  rederive(speculativeEvents: readonly TEvent[]): void {
    runInAction(() => {
      let state = this.#confirmedState;
      let version = this.#confirmedVersion;
      for (const event of speculativeEvents) {
        state = this.fold(state, event);
        version = event.streamPosition;
      }
      this._state = state;
      this.#version = speculativeEvents.length > 0 ? version : this.#confirmedVersion;
    });
  }
}
