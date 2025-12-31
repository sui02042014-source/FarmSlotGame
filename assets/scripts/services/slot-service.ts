import { SpinResult } from "../types";
import { SlotLogic } from "../logic/slot-logic";
import { GameConfig } from "../data/config/game-config";

export interface ISpinRequest {
  bet: number;
  lines: number;
}

export class SlotService {
  private static instance: SlotService;

  public static getInstance(): SlotService {
    if (!this.instance) {
      this.instance = new SlotService();
    }
    return this.instance;
  }

  public async fetchSpinResult(request: ISpinRequest): Promise<SpinResult> {
    return new Promise((resolve) => {
      const latency = 500 + Math.random() * 1000;

      setTimeout(() => {
        const result = SlotLogic.calculateSpinResult(
          GameConfig.REEL_COUNT,
          GameConfig.SYMBOL_PER_REEL,
          request.bet
        );
        resolve(result);
      }, latency);
    });
  }

  public async syncPlayerData(coins: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 300);
    });
  }
}
