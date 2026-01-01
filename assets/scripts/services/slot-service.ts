import { SpinResult } from "../types";
import { SlotLogic } from "../logic/slot-logic";
import { GameConfig } from "../data/config/game-config";
import { Logger } from "../utils/helpers/logger";
import { ErrorCode, GameErrorHandler } from "../types/error-codes";

const logger = Logger.create("SlotService");

export interface ISpinRequest {
  bet: number;
  lines: number;
}

export class SlotService {
  private static instance: SlotService;
  private networkConfig = GameConfig.NETWORK;

  public static getInstance(): SlotService {
    if (!this.instance) {
      this.instance = new SlotService();
    }
    return this.instance;
  }

  // ==========================================
  // Spin Result
  // ==========================================

  public async fetchSpinResult(request: ISpinRequest): Promise<SpinResult> {
    this.validateSpinRequest(request);

    try {
      const result = this.calculateSpinResult(request.bet);
      this.validateSpinResult(result);

      await this.simulateNetworkLatency();

      this.logSpinResult(result);

      return result;
    } catch (error) {
      this.handleSpinError(error);
      throw error;
    }
  }

  private validateSpinRequest(request: ISpinRequest): void {
    if (!Number.isFinite(request.bet) || request.bet <= 0) {
      const error = GameErrorHandler.createError(
        ErrorCode.INVALID_BET_AMOUNT,
        `Invalid bet amount: ${request.bet}`
      );
      logger.error("Invalid spin request:", error);
      throw new Error(
        GameErrorHandler.getUserMessage(ErrorCode.INVALID_BET_AMOUNT)
      );
    }
  }

  private calculateSpinResult(bet: number): SpinResult {
    return SlotLogic.calculateSpinResult(
      GameConfig.REEL_COUNT,
      GameConfig.SYMBOL_PER_REEL,
      bet
    );
  }

  private validateSpinResult(result: SpinResult): void {
    if (!result || !result.symbolGrid) {
      throw new Error("Invalid spin result generated");
    }
  }

  private async simulateNetworkLatency(): Promise<void> {
    if (this.networkConfig.ENABLE_FAKE_LATENCY) {
      const latency = this.calculateRandomLatency();
      await this.delay(latency);
    }
  }

  private calculateRandomLatency(): number {
    const min = this.networkConfig.MIN_LATENCY_MS;
    const max = this.networkConfig.MAX_LATENCY_MS;
    return min + Math.random() * (max - min);
  }

  private logSpinResult(result: SpinResult): void {
    logger.debug("Spin result generated:", {
      totalWin: result.totalWin,
      winLines: result.winLines.length,
    });
  }

  private handleSpinError(error: unknown): void {
    GameErrorHandler.createError(
      ErrorCode.SPIN_FAILED,
      "Failed to calculate spin result",
      error
    );
    logger.error("Spin calculation failed:", error);
  }

  // ==========================================
  // Player Data Sync
  // ==========================================

  public async syncPlayerData(coins: number): Promise<boolean> {
    if (!this.isValidCoinsAmount(coins)) {
      logger.warn("Invalid coins value for sync:", coins);
      return false;
    }

    try {
      await this.delay(this.networkConfig.SYNC_DELAY_MS);
      logger.debug("Player data synced, coins:", coins);
      return true;
    } catch (error) {
      this.handleSyncError(error);
      return false;
    }
  }

  private isValidCoinsAmount(coins: number): boolean {
    return Number.isFinite(coins) && coins >= 0;
  }

  private handleSyncError(error: unknown): void {
    GameErrorHandler.createError(
      ErrorCode.WALLET_SYNC_FAILED,
      "Failed to sync player data",
      error
    );
    logger.error("Sync failed:", error);
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
