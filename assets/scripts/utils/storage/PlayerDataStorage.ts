import { GameConfig } from "../../data/config/GameConfig";
import { PlayerData } from "../../types";

const KEYS = {
  COINS: "player_coins",
  BET: "current_bet",
};

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

  public static save(coins: number, bet: number): void {
    try {
      localStorage.setItem(KEYS.COINS, coins.toString());
      localStorage.setItem(KEYS.BET, bet.toString());
    } catch {}
  }

  private static getNumeric(key: string): number | null {
    const val = localStorage.getItem(key);
    if (val === null) return null;
    const p = parseFloat(val);
    return isNaN(p) ? null : p;
  }
}
