import { GameConfig } from "../data/config/game-config";
import { SymbolData } from "../data/models/symbol-data";
import { WinLine, SpinResult } from "../types";

interface WinDirection {
  colDelta: number;
  rowDelta: number;
}

export class SlotLogic {
  private static readonly MIN_WIN_LENGTH = 3;
  private static readonly WIN_DIRECTIONS: WinDirection[] = [
    { colDelta: 1, rowDelta: 0 },
    { colDelta: 0, rowDelta: 1 },
    { colDelta: 1, rowDelta: 1 },
    { colDelta: 1, rowDelta: -1 },
  ];

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

  private static generateReelSymbols(symbolsPerReel: number): string[] {
    const weights = SymbolData.getAllWeights();
    const symbols = Object.keys(weights);
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const reelSymbols: string[] = [];

    for (let row = 0; row < symbolsPerReel; row++) {
      const symbol = this.selectWeightedSymbol(symbols, weights, totalWeight);
      reelSymbols.push(symbol);
    }

    return reelSymbols;
  }

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

  public static checkWin(
    symbolGrid: string[][],
    bet: number
  ): { totalWin: number; winLines: WinLine[] } {
    // Validate inputs
    if (!symbolGrid || !Array.isArray(symbolGrid) || symbolGrid.length === 0) {
      console.warn("[SlotLogic] Invalid symbolGrid provided");
      return { totalWin: 0, winLines: [] };
    }

    if (typeof bet !== "number" || bet <= 0 || isNaN(bet)) {
      console.warn("[SlotLogic] Invalid bet amount provided:", bet);
      return { totalWin: 0, winLines: [] };
    }

    const winLines: WinLine[] = [];
    const seenLines = new Set<string>();
    const cols = symbolGrid.length;
    const rows = symbolGrid[0]?.length || 0;

    // Validate grid dimensions
    if (cols === 0 || rows === 0) {
      console.warn("[SlotLogic] Invalid grid dimensions:", { cols, rows });
      return { totalWin: 0, winLines: [] };
    }

    // Validate all rows have same length
    for (let i = 0; i < symbolGrid.length; i++) {
      if (!symbolGrid[i] || symbolGrid[i].length !== rows) {
        console.warn("[SlotLogic] Inconsistent row lengths in symbolGrid");
        return { totalWin: 0, winLines: [] };
      }
    }

    for (const direction of SlotLogic.WIN_DIRECTIONS) {
      const startPositions = this.getValidStartPositions(direction, cols, rows);

      for (const { col, row } of startPositions) {
        const line = this.checkWinInDirection(
          symbolGrid,
          col,
          row,
          direction,
          cols,
          rows,
          bet
        );

        if (line) {
          const lineKey = line.positions
            .map((p) => `${p.col},${p.row}`)
            .join("|");

          if (!seenLines.has(lineKey)) {
            seenLines.add(lineKey);
            winLines.push(line);
          }
        }
      }
    }

    const totalWin = winLines.reduce((sum, line) => sum + line.win, 0);
    return { totalWin, winLines };
  }

  private static getValidStartPositions(
    direction: WinDirection,
    cols: number,
    rows: number
  ): { col: number; row: number }[] {
    const positions: { col: number; row: number }[] = [];
    const { colDelta, rowDelta } = direction;

    if (colDelta === 1 && rowDelta === 0) {
      for (let row = 0; row < rows; row++) {
        positions.push({ col: 0, row });
      }
    } else if (colDelta === 0 && rowDelta === 1) {
      for (let col = 0; col < cols; col++) {
        positions.push({ col, row: 0 });
      }
    } else if (colDelta === 1 && rowDelta === 1) {
      for (let row = 0; row < rows; row++) {
        positions.push({ col: 0, row });
      }
      for (let col = 1; col < cols; col++) {
        positions.push({ col, row: 0 });
      }
    } else if (colDelta === 1 && rowDelta === -1) {
      for (let row = 0; row < rows; row++) {
        positions.push({ col: 0, row });
      }
      for (let col = 1; col < cols; col++) {
        positions.push({ col, row: rows - 1 });
      }
    }

    return positions;
  }

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

    for (let len = maxCols; len >= SlotLogic.MIN_WIN_LENGTH; len--) {
      const endCol = startCol + (len - 1) * colDelta;
      const endRow = startRow + (len - 1) * rowDelta;

      if (endCol < 0 || endCol >= maxCols || endRow < 0 || endRow >= maxRows) {
        continue;
      }

      const symbols = this.getSymbolsInLine(
        symbolGrid,
        startCol,
        startRow,
        direction,
        len
      );

      if (this.isValidWinLine(symbols)) {
        const baseSymbol = symbols.find((s) => s && s !== "wild") || symbols[0];
        const win = this.calculateWin(baseSymbol, len, bet);
        if (win > 0) {
          return this.createWinLine(
            baseSymbol,
            startCol,
            startRow,
            direction,
            len,
            win
          );
        }
      }
    }

    return null;
  }

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

  private static isValidWinLine(symbols: string[]): boolean {
    if (symbols.length < SlotLogic.MIN_WIN_LENGTH) {
      return false;
    }

    const firstSymbol = symbols[0];
    if (!firstSymbol || firstSymbol === "") {
      return false;
    }

    // Find first non-wild symbol to use as base for comparison
    const baseSymbol = symbols.find(
      (s) => !GameConfig.SYMBOL_PROPERTIES[s]?.isWild
    );

    if (!baseSymbol) {
      // All symbols are wild! This is a valid win.
      return true;
    }

    const baseProps = GameConfig.SYMBOL_PROPERTIES[baseSymbol];

    return symbols.every((s) => {
      if (s === baseSymbol) return true;

      const sProps = GameConfig.SYMBOL_PROPERTIES[s];

      // Wild can substitute for anything except Scatters and Bonus symbols (standard slot rules)
      if (sProps?.isWild) {
        return !baseProps?.isScatter && !baseProps?.isBonus;
      }

      return false;
    });
  }

  private static calculateWin(
    symbol: string,
    length: number,
    bet: number
  ): number {
    const symbolData = SymbolData.getSymbol(symbol);
    if (!symbolData || !symbolData.paytable) {
      return 0;
    }

    const multiplier = symbolData.paytable[length];
    return multiplier ? multiplier * bet : 0;
  }

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
