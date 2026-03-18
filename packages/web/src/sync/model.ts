import { makeObservable, observable, runInAction } from "mobx";
import type { DomainEvent } from "@heim/domain";

export abstract class Model<TState, TEvent extends DomainEvent> {
  readonly streamId: string;
  readonly streamType: string;
  protected _state: TState;
  #version: number;

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

  applyEvent(event: TEvent): void {
    runInAction(() => {
      this._state = this.fold(this._state, event);
      this.#version = event.streamPosition;
    });
  }
}
