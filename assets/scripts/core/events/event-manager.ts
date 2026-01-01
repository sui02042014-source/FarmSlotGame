import { EventTarget } from "cc";

/**
 * Global Event Manager for decoupled communication between game modules.
 * Uses Cocos EventTarget for high-performance event dispatching.
 */
export class EventManager {
  private static _instance: EventTarget | null = null;

  public static getInstance(): EventTarget {
    if (!this._instance) {
      this._instance = new EventTarget();
    }
    return this._instance;
  }

  /**
   * Shorthand for emitting events
   */
  public static emit(type: string, ...args: any[]): void {
    this.getInstance().emit(type, ...args);
  }

  /**
   * Shorthand for subscribing to events
   * @param type Event name
   * @param callback Callback function
   * @param target The "this" context for the callback
   * @param once Whether to trigger only once
   */
  public static on(
    type: string,
    callback: any,
    target?: any,
    once?: boolean
  ): void {
    this.getInstance().on(type, callback, target, once);
  }

  /**
   * Shorthand for unsubscribing from events
   * @param type Event name
   * @param callback Callback function
   * @param target The "this" context that was used for subscription
   */
  public static off(type: string, callback?: any, target?: any): void {
    this.getInstance().off(type, callback, target);
  }

  /**
   * Shorthand for subscribing to events once
   */
  public static once(type: string, callback: any, target?: any): void {
    this.getInstance().once(type, callback, target);
  }
}
