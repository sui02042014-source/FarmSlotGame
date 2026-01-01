import { _decorator, Component } from "cc";
import { Logger } from "../../utils/helpers/logger";

const { ccclass } = _decorator;
const logger = Logger.create("ReelStateMachine");

export enum ReelState {
  IDLE = "idle",
  SPINNING = "spinning",
  STOPPING = "stopping",
  RESULT = "result",
}

export interface ReelStateCallbacks {
  onStateChanged?: (oldState: ReelState, newState: ReelState) => void;
}

@ccclass("ReelStateMachine")
export class ReelStateMachine extends Component {
  private currentState: ReelState = ReelState.IDLE;
  private onStateChanged?: (oldState: ReelState, newState: ReelState) => void;

  public initialize(callbacks: ReelStateCallbacks): void {
    this.onStateChanged = callbacks.onStateChanged;
  }

  public getState(): ReelState {
    return this.currentState;
  }

  public isIdle(): boolean {
    return this.currentState === ReelState.IDLE;
  }

  public isSpinning(): boolean {
    return this.currentState === ReelState.SPINNING;
  }

  // ==========================================
  // State Transitions
  // ==========================================

  public setState(newState: ReelState): void {
    if (this.currentState === newState) return;

    const oldState = this.currentState;
    this.currentState = newState;

    this.executeCallback(oldState, newState);
  }

  private executeCallback(oldState: ReelState, newState: ReelState): void {
    if (!this.onStateChanged) return;

    try {
      this.onStateChanged(oldState, newState);
    } catch (error) {
      logger.error(
        `Error in state change callback (${oldState} -> ${newState}):`,
        error
      );
    }
  }

  public startSpin(): void {
    if (this.canSpin()) {
      this.setState(ReelState.SPINNING);
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
}
