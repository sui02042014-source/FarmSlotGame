import { GameConfig } from "../data/GameConfig";

export interface PlayerData {
  coins: number;
  bet: number;
  betIndex: number;
}

const STORAGE_KEYS = {
  PLAYER_COINS: "playerCoins",
  CURRENT_BET: "currentBet",
} as const;

export class PlayerDataStorage {
  public static load(defaultCoins: number, defaultBet: number): PlayerData {
    let coins = defaultCoins;
    let bet = defaultBet;
    let betIndex = GameConfig.BET_STEPS.indexOf(defaultBet);

    const savedCoins = localStorage.getItem(STORAGE_KEYS.PLAYER_COINS);
    if (savedCoins) {
      const parsed = parseFloat(savedCoins);
      if (!Number.isNaN(parsed) && parsed > 0) {
        coins = parsed;
      }
    }

    const savedBet = localStorage.getItem(STORAGE_KEYS.CURRENT_BET);
    if (savedBet) {
      const parsed = parseFloat(savedBet);
      if (!Number.isNaN(parsed) && parsed > 0) {
        const idx = GameConfig.BET_STEPS.indexOf(parsed);
        if (idx >= 0) {
          bet = parsed;
          betIndex = idx;
        }
      }
    }

    if (betIndex < 0) {
      betIndex = 0;
      bet = GameConfig.BET_STEPS[0];
    }

    return {
      coins,
      bet,
      betIndex,
    };
  }

  public static save(coins: number, bet: number): void {
    localStorage.setItem(STORAGE_KEYS.PLAYER_COINS, coins.toString());
    localStorage.setItem(STORAGE_KEYS.CURRENT_BET, bet.toString());
  }
}
