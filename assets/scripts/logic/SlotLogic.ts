import { GameConfig } from "../data/GameConfig";

/**
 * Win line direction vectors for pattern matching
 */
interface WinDirection {
  colDelta: number;
  rowDelta: number;
}

/**
 * Represents a winning line on the slot machine
 */
export interface WinLine {
  symbol: string;
  count: number;
  positions: { col: number; row: number }[];
  win: number;
}

/**
 * Result of a spin calculation
 */
export interface SpinResult {
  symbolGrid: string[][];
  totalWin: number;
  winLines: WinLine[];
}

export class SlotLogic {
  private static readonly MIN_WIN_LENGTH = 3;
  private static readonly WIN_DIRECTIONS: WinDirection[] = [
    { colDelta: 1, rowDelta: 0 }, // Horizontal
    { colDelta: 0, rowDelta: 1 }, // Vertical
    { colDelta: 1, rowDelta: 1 }, // Diagonal down-right
    { colDelta: 1, rowDelta: -1 }, // Diagonal up-right
  ];

  /**
   * Generate target symbols for all reels
   * @param reelCount Number of reels
   * @param symbolsPerReel Number of visible symbols per reel
   * @returns 2D array of symbol IDs [col][row]
   */
  public static generateTargetSymbols(
    reelCount: number = GameConfig.REEL_COUNT,
    symbolsPerReel: number = GameConfig.SYMBOL_PER_REEL
  ): string[][] {
    const targetSymbols: string[][] = [];

    for (let col = 0; col < reelCount; col++) {
      const reelSymbols = this.generateReelSymbols(symbolsPerReel);
      targetSymbols.push(reelSymbols);
    }

    return targetSymbols;
  }

  /**
   * Generate symbols for a single reel
   * @param symbolsPerReel Number of symbols to generate
   * @returns Array of symbol IDs
   */
  private static generateReelSymbols(symbolsPerReel: number): string[] {
    const weights = GameConfig.SYMBOL_WEIGHTS;
    const symbols = Object.keys(weights);
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const reelSymbols: string[] = [];

    for (let row = 0; row < symbolsPerReel; row++) {
      const symbol = this.selectWeightedSymbol(symbols, weights, totalWeight);
      reelSymbols.push(symbol);
    }

    return reelSymbols;
  }

  /**
   * Select a symbol based on weighted random
   * @param symbols Array of symbol IDs
   * @param weights Weight map for each symbol
   * @param totalWeight Sum of all weights
   * @returns Selected symbol ID
   */
  private static selectWeightedSymbol(
    symbols: string[],
    weights: Record<string, number>,
    totalWeight: number
  ): string {
    let random = Math.random() * totalWeight;
    for (const symbol of symbols) {
      random -= weights[symbol];
      if (random <= 0) {
        return symbol;
      }
    }
    return symbols[0];
  }

  /**
   * Check for winning lines in a symbol grid
   * @param symbolGrid 2D array of symbol IDs [col][row]
   * @param bet Current bet amount
   * @returns Object containing total win and win lines
   */
  public static checkWin(
    symbolGrid: string[][],
    bet: number
  ): { totalWin: number; winLines: WinLine[] } {
    const winLines: WinLine[] = [];
    const cols = symbolGrid.length;
    const rows = symbolGrid[0]?.length || 0;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const lines = this.checkWinFromPosition(
          symbolGrid,
          col,
          row,
          cols,
          rows,
          bet
        );
        winLines.push(...lines);
      }
    }

    const totalWin = winLines.reduce((sum, line) => sum + line.win, 0);
    return { totalWin, winLines };
  }

  /**
   * Check for wins starting from a specific position
   */
  private static checkWinFromPosition(
    symbolGrid: string[][],
    startCol: number,
    startRow: number,
    maxCols: number,
    maxRows: number,
    bet: number
  ): WinLine[] {
    const winLines: WinLine[] = [];

    for (const direction of SlotLogic.WIN_DIRECTIONS) {
      const line = this.checkWinInDirection(
        symbolGrid,
        startCol,
        startRow,
        direction,
        maxCols,
        maxRows,
        bet
      );
      if (line) {
        winLines.push(line);
      }
    }

    return winLines;
  }

  /**
   * Check for a win in a specific direction
   */
  private static checkWinInDirection(
    symbolGrid: string[][],
    startCol: number,
    startRow: number,
    direction: WinDirection,
    maxCols: number,
    maxRows: number,
    bet: number
  ): WinLine | null {
    const { colDelta, rowDelta } = direction;
    const endCol = startCol + (SlotLogic.MIN_WIN_LENGTH - 1) * colDelta;
    const endRow = startRow + (SlotLogic.MIN_WIN_LENGTH - 1) * rowDelta;

    if (endCol < 0 || endCol >= maxCols || endRow < 0 || endRow >= maxRows) {
      return null;
    }

    const symbols = this.getSymbolsInLine(
      symbolGrid,
      startCol,
      startRow,
      direction,
      SlotLogic.MIN_WIN_LENGTH
    );

    if (!this.isValidWinLine(symbols)) {
      return null;
    }

    const win = this.calculateWin(symbols[0], bet);
    if (win <= 0) {
      return null;
    }

    return this.createWinLine(
      symbols[0],
      startCol,
      startRow,
      direction,
      SlotLogic.MIN_WIN_LENGTH,
      win
    );
  }

  /**
   * Get symbols in a line
   */
  private static getSymbolsInLine(
    symbolGrid: string[][],
    startCol: number,
    startRow: number,
    direction: WinDirection,
    length: number
  ): string[] {
    const symbols: string[] = [];
    const { colDelta, rowDelta } = direction;

    for (let i = 0; i < length; i++) {
      const col = startCol + i * colDelta;
      const row = startRow + i * rowDelta;
      const symbol = symbolGrid[col]?.[row] ?? "";
      symbols.push(symbol);
    }

    return symbols;
  }

  /**
   * Check if a line of symbols is a valid win
   */
  private static isValidWinLine(symbols: string[]): boolean {
    if (symbols.length < SlotLogic.MIN_WIN_LENGTH) {
      return false;
    }

    const firstSymbol = symbols[0];
    if (!firstSymbol) {
      return false;
    }

    return symbols.every((symbol) => symbol === firstSymbol);
  }

  /**
   * Calculate win amount for a symbol
   */
  private static calculateWin(symbol: string, bet: number): number {
    const paytable = GameConfig.PAYTABLE[symbol];
    if (!paytable) {
      return 0;
    }

    const multiplier = paytable[SlotLogic.MIN_WIN_LENGTH];
    return multiplier ? multiplier * bet : 0;
  }

  /**
   * Create a WinLine object
   */
  private static createWinLine(
    symbol: string,
    startCol: number,
    startRow: number,
    direction: WinDirection,
    length: number,
    win: number
  ): WinLine {
    const positions: { col: number; row: number }[] = [];
    const { colDelta, rowDelta } = direction;

    for (let i = 0; i < length; i++) {
      positions.push({
        col: startCol + i * colDelta,
        row: startRow + i * rowDelta,
      });
    }

    return {
      symbol,
      count: length,
      positions,
      win,
    };
  }

  /**
   * Calculate a complete spin result
   * @param reelCount Number of reels
   * @param symbolsPerReel Number of visible symbols per reel
   * @param bet Current bet amount
   * @returns Complete spin result with symbol grid and win information
   */
  public static calculateSpinResult(
    reelCount: number = GameConfig.REEL_COUNT,
    symbolsPerReel: number = GameConfig.SYMBOL_PER_REEL,
    bet: number
  ): SpinResult {
    const symbolGrid = this.generateTargetSymbols(reelCount, symbolsPerReel);
    const { totalWin, winLines } = this.checkWin(symbolGrid, bet);

    return {
      symbolGrid,
      totalWin,
      winLines,
    };
  }
}
