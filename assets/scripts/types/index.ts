// Game Types and Interfaces
export type GameState =
  | "idle"
  | "spinning"
  | "stopping"
  | "win_show"
  | "bonus_game"
  | "free_spins";

export interface PlayerData {
  coins: number;
  bet: number;
  betIndex: number;
}

export interface WinLine {
  symbol: string;
  count: number;
  positions: { col: number; row: number }[];
  win: number;
}

export interface SpinResult {
  symbolGrid: string[][];
  totalWin: number;
  winLines: WinLine[];
}

export interface SymbolData {
  id: string;
  spritePath: string;
  weight: number;
  paytable: Record<number, number>;
}

// Re-export commonly used types from other modules
export type { GameConfig } from "../data/config/GameConfig";
