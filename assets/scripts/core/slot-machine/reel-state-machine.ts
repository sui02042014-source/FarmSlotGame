import { _decorator, Component } from "cc";

const { ccclass } = _decorator;

export enum ReelState {
  IDLE = "idle",
  SPINNING_ACCEL = "spinning_accel",
  SPINNING_CONST = "spinning_const",
  STOPPING = "stopping",
  RESULT = "result",
}

export interface ReelStateCallbacks {
  onStateEnter?: (state: ReelState) => void;
  onStateExit?: (state: ReelState) => void;
  onStateChanged?: (oldState: ReelState, newState: ReelState) => void;
}

@ccclass("ReelStateMachine")
export class ReelStateMachine extends Component {
  private currentState: ReelState = ReelState.IDLE;
  private callbacks: ReelStateCallbacks = {};

  // ==========================================
  // Initialization
  // ==========================================

  public initialize(callbacks: ReelStateCallbacks): void {
    this.callbacks = callbacks;
  }

  // ==========================================
  // State Queries
  // ==========================================

  public getState(): ReelState {
    return this.currentState;
  }

  public isState(state: ReelState): boolean {
    return this.currentState === state;
  }

  public isIdle(): boolean {
    return this.currentState === ReelState.IDLE;
  }

  public isSpinning(): boolean {
    return (
      this.currentState === ReelState.SPINNING_ACCEL ||
      this.currentState === ReelState.SPINNING_CONST
    );
  }

  public isStopping(): boolean {
    return this.currentState === ReelState.STOPPING;
  }

  public isResult(): boolean {
    return this.currentState === ReelState.RESULT;
  }

  // ==========================================
  // State Transitions
  // ==========================================

  public setState(newState: ReelState): void {
    if (this.currentState === newState) return;

    const oldState = this.currentState;
    this.currentState = newState;

    if (this.callbacks.onStateExit) {
      this.callbacks.onStateExit(oldState);
    }

    if (this.callbacks.onStateEnter) {
      this.callbacks.onStateEnter(newState);
    }

    if (this.callbacks.onStateChanged) {
      this.callbacks.onStateChanged(oldState, newState);
    }
  }

  public startSpin(): void {
    if (
      this.currentState === ReelState.IDLE ||
      this.currentState === ReelState.RESULT
    ) {
      this.setState(ReelState.SPINNING_ACCEL);
    }
  }

  public startConstantSpin(): void {
    if (this.currentState === ReelState.SPINNING_ACCEL) {
      this.setState(ReelState.SPINNING_CONST);
    }
  }

  public startStopping(): void {
    if (this.isSpinning()) {
      this.setState(ReelState.STOPPING);
    }
  }

  public setResult(): void {
    if (this.currentState === ReelState.STOPPING) {
      this.setState(ReelState.RESULT);
    }
  }

  public reset(): void {
    this.setState(ReelState.IDLE);
  }

  // ==========================================
  // State Validation
  // ==========================================

  public canSpin(): boolean {
    return (
      this.currentState === ReelState.IDLE ||
      this.currentState === ReelState.RESULT
    );
  }

  public canStop(): boolean {
    return this.isSpinning() || this.currentState === ReelState.STOPPING;
  }
}
