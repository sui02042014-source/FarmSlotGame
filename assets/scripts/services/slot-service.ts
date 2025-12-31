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

  /**
   * Mô phỏng gọi API lấy kết quả spin từ Server
   */
  public async fetchSpinResult(request: ISpinRequest): Promise<SpinResult> {
    return new Promise((resolve) => {
      // Giả lập độ trễ mạng từ 0.5s - 1.5s
      const latency = 500 + Math.random() * 1000;

      setTimeout(() => {
        const result = SlotLogic.calculateSpinResult(
          GameConfig.REEL_COUNT,
          GameConfig.SYMBOL_PER_REEL,
          request.bet
        );

        console.log(
          `[SlotService] API Response received in ${latency.toFixed(0)}ms:`,
          result
        );
        resolve(result);
      }, latency);
    });
  }

  /**
   * Mô phỏng API đồng bộ hóa dữ liệu người chơi
   */
  public async syncPlayerData(coins: number): Promise<boolean> {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log(`[SlotService] Player data synced: ${coins} coins`);
        resolve(true);
      }, 300);
    });
  }
}
