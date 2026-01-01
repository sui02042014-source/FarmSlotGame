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

/**
 * ⚠️ SECURITY WARNING - FOR DEVELOPMENT/DEMO ONLY ⚠️
 *
 * This service currently generates spin results CLIENT-SIDE using SlotLogic.
 * This is INSECURE for production!
 *
 * FOR PRODUCTION:
 * Replace the mock implementation in fetchSpinResult() with:
 * - Real HTTP request to backend API endpoint
 * - Server generates results using secure RNG
 * - Server validates bet amount and player session
 * - Server updates player balance atomically
 * - Server returns signed/encrypted results
 *
 * Example production implementation:
 * ```typescript
 * public async fetchSpinResult(request: ISpinRequest): Promise<SpinResult> {
 *   const response = await fetch('/api/slot/spin', {
 *     method: 'POST',
 *     headers: { 'Authorization': `Bearer ${sessionToken}` },
 *     body: JSON.stringify(request)
 *   });
 *   return await response.json();
 * }
 * ```
 */
export class SlotService {
  private static instance: SlotService;

  public static getInstance(): SlotService {
    if (!this.instance) {
      this.instance = new SlotService();
    }
    return this.instance;
  }

  /**
   * Fetch spin result from server (currently mocked)
   * @param request - Spin request with bet and lines
   * @returns SpinResult with symbol grid and win information
   * @throws Error if spin calculation fails
   */
  public async fetchSpinResult(request: ISpinRequest): Promise<SpinResult> {
    // Validate request
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

    try {
      const result = SlotLogic.calculateSpinResult(
        GameConfig.REEL_COUNT,
        GameConfig.SYMBOL_PER_REEL,
        request.bet
      );

      if (!result || !result.symbolGrid) {
        throw new Error("Invalid spin result generated");
      }

      if (GameConfig.NETWORK.ENABLE_FAKE_LATENCY) {
        const latency =
          GameConfig.NETWORK.MIN_LATENCY_MS +
          Math.random() *
            (GameConfig.NETWORK.MAX_LATENCY_MS -
              GameConfig.NETWORK.MIN_LATENCY_MS);

        await new Promise((resolve) => setTimeout(resolve, latency));
      }

      logger.debug("Spin result generated:", {
        totalWin: result.totalWin,
        winLines: result.winLines.length,
      });

      return result;
    } catch (error) {
      GameErrorHandler.createError(
        ErrorCode.SPIN_FAILED,
        "Failed to calculate spin result",
        error
      );
      logger.error("Spin calculation failed:", error);
      throw error;
    }
  }

  public async syncPlayerData(coins: number): Promise<boolean> {
    if (!Number.isFinite(coins) || coins < 0) {
      logger.warn("Invalid coins value for sync:", coins);
      return false;
    }

    try {
      await new Promise((resolve) =>
        setTimeout(resolve, GameConfig.NETWORK.SYNC_DELAY_MS)
      );
      logger.debug("Player data synced, coins:", coins);
      return true;
    } catch (error) {
      GameErrorHandler.createError(
        ErrorCode.WALLET_SYNC_FAILED,
        "Failed to sync player data",
        error
      );
      logger.error("Sync failed:", error);
      return false;
    }
  }
}
