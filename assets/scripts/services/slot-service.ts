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
    const result = SlotLogic.calculateSpinResult(
      GameConfig.REEL_COUNT,
      GameConfig.SYMBOL_PER_REEL,
      request.bet
    );

    // Simulate network latency if enabled (for testing)
    if (GameConfig.NETWORK.ENABLE_FAKE_LATENCY) {
      const latency =
        GameConfig.NETWORK.MIN_LATENCY_MS +
        Math.random() *
          (GameConfig.NETWORK.MAX_LATENCY_MS -
            GameConfig.NETWORK.MIN_LATENCY_MS);

      return new Promise((resolve) => {
        setTimeout(() => resolve(result), latency);
      });
    }

    return result;
  }

  public async syncPlayerData(coins: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(true);
      }, 300);
    });
  }
}
