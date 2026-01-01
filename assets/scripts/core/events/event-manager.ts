import { EventTarget } from "cc";

export class EventManager {
  private static _instance: EventTarget | null = null;

  public static getInstance(): EventTarget {
    if (!this._instance) {
      this._instance = new EventTarget();
    }
    return this._instance;
  }

  public static emit(type: string, ...args: any[]): void {
    this.getInstance().emit(type, ...args);
  }

  public static on(
    type: string,
    callback: any,
    target?: any,
    once?: boolean
  ): void {
    this.getInstance().on(type, callback, target, once);
  }

  public static off(type: string, callback?: any, target?: any): void {
    this.getInstance().off(type, callback, target);
  }
}
