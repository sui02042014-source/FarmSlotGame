import { sys } from "cc";
import { GameConfig } from "../../data/config/game-config";
import { PlayerData } from "../../types";
import { Logger } from "../helpers/logger";

const KEYS = {
  COINS: "player_coins",
  BET: "current_bet",
};

const logger = Logger.create("PlayerDataStorage");

export class PlayerDataStorage {
  public static load(defaultCoins: number, defaultBet: number): PlayerData {
    const savedCoins = this.getNumeric(KEYS.COINS);
    const coins =
      savedCoins !== null && savedCoins >= 0 ? savedCoins : defaultCoins;

    const savedBet = this.getNumeric(KEYS.BET);
    let bet = savedBet ?? defaultBet;
    let betIndex = GameConfig.BET_STEPS.indexOf(bet);

    if (betIndex < 0) {
      betIndex = Math.max(0, GameConfig.BET_STEPS.indexOf(defaultBet));
      bet = GameConfig.BET_STEPS[betIndex];
    }

    return { coins, bet, betIndex };
  }

  public static save(coins: number, bet: number): boolean {
    try {
      if (!this.isValidData(coins, bet)) {
        logger.error("Invalid data:", { coins, bet });
        return false;
      }

      sys.localStorage.setItem(KEYS.COINS, coins.toString());
      sys.localStorage.setItem(KEYS.BET, bet.toString());
      return true;
    } catch (error) {
      logger.error("Failed to save:", error);
      return false;
    }
  }

  private static isValidData(coins: number, bet: number): boolean {
    if (typeof coins !== "number" || isNaN(coins) || coins < 0) {
      return false;
    }

    if (typeof bet !== "number" || isNaN(bet) || bet < 0) {
      return false;
    }

    if (
      bet < GameConfig.MIN_BET ||
      bet > GameConfig.MAX_BET ||
      !GameConfig.BET_STEPS.includes(bet)
    ) {
      logger.warn(`Bet ${bet} is not in valid BET_STEPS`);
    }

    return true;
  }

  private static getNumeric(key: string): number | null {
    try {
      const val = sys.localStorage.getItem(key);
      if (val === null) return null;
      const p = parseFloat(val);
      return isNaN(p) ? null : p;
    } catch (error) {
      logger.error(`Failed to get ${key}:`, error);
      return null;
    }
  }

  /**
   * Clear all saved player data
   */
  public static clear(): void {
    try {
      sys.localStorage.removeItem(KEYS.COINS);
      sys.localStorage.removeItem(KEYS.BET);
    } catch (error) {
      logger.error("Failed to clear:", error);
    }
  }
}
