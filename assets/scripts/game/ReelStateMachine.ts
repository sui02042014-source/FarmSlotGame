import { _decorator, Component } from "cc";

const { ccclass } = _decorator;

/**
 * Reel States for State Machine
 */
export enum ReelState {
  IDLE = "idle",
  SPINNING_ACCEL = "spinning_accel",
  SPINNING_CONST = "spinning_const",
  STOPPING = "stopping",
  RESULT = "result",
}

/**
 * Callbacks for state transitions
 */
export interface ReelStateCallbacks {
  onStateEnter?: (state: ReelState) => void;
  onStateExit?: (state: ReelState) => void;
  onStateChanged?: (oldState: ReelState, newState: ReelState) => void;
}

/**
 * ReelStateMachine - Manages reel state transitions and callbacks
 *
 * Handles the state machine logic: IDLE -> SPINNING_ACCEL -> SPINNING_CONST -> STOPPING -> RESULT
 */
@ccclass("ReelStateMachine")
export class ReelStateMachine extends Component {
  private currentState: ReelState = ReelState.IDLE;
  private callbacks: ReelStateCallbacks = {};

  /**
   * Initialize the state machine with callbacks
   */
  public initialize(callbacks: ReelStateCallbacks): void {
    this.callbacks = callbacks;
  }

  /**
   * Get the current state
   */
  public getState(): ReelState {
    return this.currentState;
  }

  /**
   * Check if the state machine is in a specific state
   */
  public isState(state: ReelState): boolean {
    return this.currentState === state;
  }

  /**
   * Check if the reel is idle
   */
  public isIdle(): boolean {
    return this.currentState === ReelState.IDLE;
  }

  /**
   * Check if the reel is spinning
   */
  public isSpinning(): boolean {
    return (
      this.currentState === ReelState.SPINNING_ACCEL ||
      this.currentState === ReelState.SPINNING_CONST
    );
  }

  /**
   * Check if the reel is stopping
   */
  public isStopping(): boolean {
    return this.currentState === ReelState.STOPPING;
  }

  /**
   * Check if the reel is in result state
   */
  public isResult(): boolean {
    return this.currentState === ReelState.RESULT;
  }

  /**
   * Set a new state (triggers callbacks)
   */
  public setState(newState: ReelState): void {
    if (this.currentState === newState) return;

    const oldState = this.currentState;
    this.currentState = newState;

    // Trigger callbacks
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

  /**
   * Transition to spinning acceleration state
   */
  public startSpin(): void {
    if (
      this.currentState === ReelState.IDLE ||
      this.currentState === ReelState.RESULT
    ) {
      this.setState(ReelState.SPINNING_ACCEL);
    }
  }

  /**
   * Transition to constant spin state
   */
  public startConstantSpin(): void {
    if (this.currentState === ReelState.SPINNING_ACCEL) {
      this.setState(ReelState.SPINNING_CONST);
    }
  }

  /**
   * Transition to stopping state
   */
  public startStopping(): void {
    if (this.isSpinning()) {
      this.setState(ReelState.STOPPING);
    }
  }

  /**
   * Transition to result state
   */
  public setResult(): void {
    if (this.currentState === ReelState.STOPPING) {
      this.setState(ReelState.RESULT);
    }
  }

  /**
   * Reset to idle state
   */
  public reset(): void {
    this.setState(ReelState.IDLE);
  }

  /**
   * Check if state can transition to spinning
   */
  public canSpin(): boolean {
    return (
      this.currentState === ReelState.IDLE ||
      this.currentState === ReelState.RESULT
    );
  }

  /**
   * Check if state can stop
   */
  public canStop(): boolean {
    return this.isSpinning() || this.currentState === ReelState.STOPPING;
  }
}
