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

export type { GameConfig, GameState } from "../data/config/game-config";
export type { SymbolData } from "../data/models/symbol-data";
export * from "./error-codes";
