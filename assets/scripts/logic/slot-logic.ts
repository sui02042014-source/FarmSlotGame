import { GameConfig } from "../data/config/game-config";
import { SymbolData } from "../data/models/symbol-data";
import { WinLine, SpinResult } from "../types";
import { Logger } from "../utils/helpers/logger";

const logger = Logger.create("SlotLogic");

interface WinDirection {
  colDelta: number;
  rowDelta: number;
}

const SLOT_LOGIC_CONSTANTS = {
  MIN_WIN_LENGTH: 3,
  INITIAL_RANDOM_WEIGHT: 0,
} as const;

const WIN_DIRECTIONS: readonly WinDirection[] = [
  { colDelta: 1, rowDelta: 0 }, // Horizontal
  { colDelta: 0, rowDelta: 1 }, // Vertical
  { colDelta: 1, rowDelta: 1 }, // Diagonal down-right
  { colDelta: 1, rowDelta: -1 }, // Diagonal up-right
];

const EMPTY_WIN_RESULT: { totalWin: number; winLines: WinLine[] } = {
  totalWin: 0,
  winLines: [],
};

export class SlotLogic {
  private static cachedWeights: Record<string, number> | null = null;
  private static cachedSymbols: string[] | null = null;
  private static cachedTotalWeight: number = 0;

  // ==========================================
  // Symbol Generation
  // ==========================================

  public static generateTargetSymbols(
    reelCount: number = GameConfig.REEL_COUNT,
    symbolsPerReel: number = GameConfig.SYMBOL_PER_REEL
  ): string[][] {
    this.ensureWeightsCached();

    const targetSymbols: string[][] = [];
    for (let col = 0; col < reelCount; col++) {
      const reelSymbols = this.generateReelSymbols(symbolsPerReel);
      targetSymbols.push(reelSymbols);
    }
    return targetSymbols;
  }

  private static ensureWeightsCached(): void {
    if (!this.cachedWeights) {
      this.cachedWeights = SymbolData.getAllWeights();
      this.cachedSymbols = Object.keys(this.cachedWeights);
      this.cachedTotalWeight = Object.values(this.cachedWeights).reduce(
        (a, b) => a + b,
        SLOT_LOGIC_CONSTANTS.INITIAL_RANDOM_WEIGHT
      );
    }
  }

  private static generateReelSymbols(symbolsPerReel: number): string[] {
    const reelSymbols: string[] = [];

    for (let row = 0; row < symbolsPerReel; row++) {
      const symbol = this.selectWeightedSymbol();
      reelSymbols.push(symbol);
    }

    return reelSymbols;
  }

  private static selectWeightedSymbol(): string {
    let random = Math.random() * this.cachedTotalWeight;

    for (const symbol of this.cachedSymbols!) {
      random -= this.cachedWeights![symbol];
      if (random <= 0) {
        return symbol;
      }
    }

    return this.cachedSymbols![0];
  }

  // ==========================================
  // Win Checking
  // ==========================================

  public static checkWin(
    symbolGrid: string[][],
    bet: number
  ): { totalWin: number; winLines: WinLine[] } {
    const validationError = this.validateInputs(symbolGrid, bet);
    if (validationError) {
      return EMPTY_WIN_RESULT;
    }

    const winLines: WinLine[] = [];
    const seenLines = new Set<string>();
    const cols = symbolGrid.length;
    const rows = symbolGrid[0].length;

    for (const direction of WIN_DIRECTIONS) {
      this.findWinsInDirection(
        symbolGrid,
        direction,
        cols,
        rows,
        bet,
        winLines,
        seenLines
      );
    }

    const totalWin = winLines.reduce((sum, line) => sum + line.win, 0);
    return { totalWin, winLines };
  }

  private static validateInputs(symbolGrid: string[][], bet: number): boolean {
    if (!symbolGrid || !Array.isArray(symbolGrid) || symbolGrid.length === 0) {
      logger.warn("Invalid symbolGrid provided");
      return true;
    }

    if (typeof bet !== "number" || bet <= 0 || isNaN(bet)) {
      logger.warn("Invalid bet amount provided:", bet);
      return true;
    }

    const cols = symbolGrid.length;
    const rows = symbolGrid[0]?.length || 0;

    if (cols === 0 || rows === 0) {
      logger.warn("Invalid grid dimensions:", { cols, rows });
      return true;
    }

    for (let i = 0; i < symbolGrid.length; i++) {
      if (!symbolGrid[i] || symbolGrid[i].length !== rows) {
        logger.warn("Inconsistent row lengths in symbolGrid");
        return true;
      }
    }

    return false;
  }

  private static findWinsInDirection(
    symbolGrid: string[][],
    direction: WinDirection,
    cols: number,
    rows: number,
    bet: number,
    winLines: WinLine[],
    seenLines: Set<string>
  ): void {
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

      if (line && this.isNewWinLine(line, seenLines)) {
        winLines.push(line);
      }
    }
  }

  private static isNewWinLine(line: WinLine, seenLines: Set<string>): boolean {
    const lineKey = line.positions.map((p) => `${p.col},${p.row}`).join("|");

    if (seenLines.has(lineKey)) {
      return false;
    }

    seenLines.add(lineKey);
    return true;
  }

  // ==========================================
  // Start Position Calculation
  // ==========================================

  private static getValidStartPositions(
    direction: WinDirection,
    cols: number,
    rows: number
  ): { col: number; row: number }[] {
    const { colDelta, rowDelta } = direction;

    if (colDelta === 1 && rowDelta === 0) {
      return this.getHorizontalStartPositions(rows);
    } else if (colDelta === 0 && rowDelta === 1) {
      return this.getVerticalStartPositions(cols);
    } else if (colDelta === 1 && rowDelta === 1) {
      return this.getDiagonalDownStartPositions(cols, rows);
    } else if (colDelta === 1 && rowDelta === -1) {
      return this.getDiagonalUpStartPositions(cols, rows);
    }

    return [];
  }

  private static getHorizontalStartPositions(
    rows: number
  ): { col: number; row: number }[] {
    const positions: { col: number; row: number }[] = [];
    for (let row = 0; row < rows; row++) {
      positions.push({ col: 0, row });
    }
    return positions;
  }

  private static getVerticalStartPositions(
    cols: number
  ): { col: number; row: number }[] {
    const positions: { col: number; row: number }[] = [];
    for (let col = 0; col < cols; col++) {
      positions.push({ col, row: 0 });
    }
    return positions;
  }

  private static getDiagonalDownStartPositions(
    cols: number,
    rows: number
  ): { col: number; row: number }[] {
    const positions: { col: number; row: number }[] = [];

    for (let row = 0; row < rows; row++) {
      positions.push({ col: 0, row });
    }

    for (let col = 1; col < cols; col++) {
      positions.push({ col, row: 0 });
    }

    return positions;
  }

  private static getDiagonalUpStartPositions(
    cols: number,
    rows: number
  ): { col: number; row: number }[] {
    const positions: { col: number; row: number }[] = [];

    for (let row = 0; row < rows; row++) {
      positions.push({ col: 0, row });
    }

    for (let col = 1; col < cols; col++) {
      positions.push({ col, row: rows - 1 });
    }

    return positions;
  }

  // ==========================================
  // Win Line Checking
  // ==========================================

  private static checkWinInDirection(
    symbolGrid: string[][],
    startCol: number,
    startRow: number,
    direction: WinDirection,
    maxCols: number,
    maxRows: number,
    bet: number
  ): WinLine | null {
    for (let len = maxCols; len >= SLOT_LOGIC_CONSTANTS.MIN_WIN_LENGTH; len--) {
      if (
        !this.isValidEndPosition(
          startCol,
          startRow,
          direction,
          len,
          maxCols,
          maxRows
        )
      ) {
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
        const winLine = this.tryCreateWinLine(
          symbols,
          startCol,
          startRow,
          direction,
          len,
          bet
        );

        if (winLine) {
          return winLine;
        }
      }
    }

    return null;
  }

  private static isValidEndPosition(
    startCol: number,
    startRow: number,
    direction: WinDirection,
    length: number,
    maxCols: number,
    maxRows: number
  ): boolean {
    const { colDelta, rowDelta } = direction;
    const endCol = startCol + (length - 1) * colDelta;
    const endRow = startRow + (length - 1) * rowDelta;

    return endCol >= 0 && endCol < maxCols && endRow >= 0 && endRow < maxRows;
  }

  private static tryCreateWinLine(
    symbols: string[],
    startCol: number,
    startRow: number,
    direction: WinDirection,
    length: number,
    bet: number
  ): WinLine | null {
    const baseSymbol =
      symbols.find((s) => s && s !== GameConfig.SYMBOL_TYPES.WILD) ||
      GameConfig.SYMBOL_TYPES.WILD;

    const win = this.calculateWin(baseSymbol, length, bet);

    if (win > 0) {
      return this.createWinLine(
        baseSymbol,
        startCol,
        startRow,
        direction,
        length,
        win
      );
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

  // ==========================================
  // Symbol Properties & Validation
  // ==========================================

  private static getSymbolProps(symbolId: string) {
    return (GameConfig.SYMBOL_PROPERTIES as Record<string, any>)[symbolId];
  }

  private static isValidWinLine(symbols: string[]): boolean {
    if (symbols.length < SLOT_LOGIC_CONSTANTS.MIN_WIN_LENGTH) {
      return false;
    }

    const firstSymbol = symbols[0];
    if (!firstSymbol || firstSymbol === "") {
      return false;
    }

    const baseSymbol = symbols.find((s) => !this.getSymbolProps(s)?.isWild);

    if (!baseSymbol) {
      return true;
    }

    return this.checkSymbolsMatch(symbols, baseSymbol);
  }

  private static checkSymbolsMatch(
    symbols: string[],
    baseSymbol: string
  ): boolean {
    const baseProps = this.getSymbolProps(baseSymbol);

    return symbols.every((s) => {
      if (s === baseSymbol) return true;

      const sProps = this.getSymbolProps(s);

      if (sProps?.isWild) {
        return !baseProps?.isScatter && !baseProps?.isBonus;
      }

      return false;
    });
  }

  // ==========================================
  // Win Calculation
  // ==========================================

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

  // ==========================================
  // Win Line Creation
  // ==========================================

  private static createWinLine(
    symbol: string,
    startCol: number,
    startRow: number,
    direction: WinDirection,
    length: number,
    win: number
  ): WinLine {
    const positions = this.calculatePositions(
      startCol,
      startRow,
      direction,
      length
    );

    return {
      symbol,
      count: length,
      positions,
      win,
    };
  }

  private static calculatePositions(
    startCol: number,
    startRow: number,
    direction: WinDirection,
    length: number
  ): { col: number; row: number }[] {
    const positions: { col: number; row: number }[] = [];
    const { colDelta, rowDelta } = direction;

    for (let i = 0; i < length; i++) {
      positions.push({
        col: startCol + i * colDelta,
        row: startRow + i * rowDelta,
      });
    }

    return positions;
  }

  // ==========================================
  // Public API
  // ==========================================

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
