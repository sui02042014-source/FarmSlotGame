import { _decorator, Component, Node } from "cc";
import { GameConfig } from "../data/GameConfig";
import { ReelController } from "./ReelController";
import { GameManager } from "./GameManager";
const { ccclass, property } = _decorator;

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

@ccclass("SlotMachine")
export class SlotMachine extends Component {
  @property([Node])
  reels: Node[] = [];

  private reelControllers: Array<ReelController | null> = [];
  private isSpinning: boolean = false;
  private currentSymbols: string[][] = [];
  private readonly debugLogs: boolean = false;

  private static readonly MIN_WIN_LENGTH = 3;
  private static readonly WIN_DIRECTIONS: WinDirection[] = [
    { colDelta: 1, rowDelta: 0 }, // Horizontal
    { colDelta: 0, rowDelta: 1 }, // Vertical
    { colDelta: 1, rowDelta: 1 }, // Diagonal down-right
    { colDelta: 1, rowDelta: -1 }, // Diagonal up-right
  ];

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  protected start(): void {
    this.initializeReelControllers();
    if (this.debugLogs) {
      const count = this.reelControllers.filter(Boolean).length;
      console.log(`[SlotMachine] Initialized with ${count} reel controllers`);
    }
  }

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  private initializeReelControllers(): void {
    this.reelControllers = new Array(this.reels.length).fill(null);
    this.reels.forEach((reel, col) => {
      const controller = reel.getComponent(ReelController);
      if (!controller) {
        console.warn(`[SlotMachine] ReelController missing at col ${col}`);
        return;
      }
      this.reelControllers[col] = controller;
    });
  }

  private ensureReelControllersInitialized(): void {
    if (!this.reelControllers.length) {
      this.initializeReelControllers();
    }
  }

  private getReelCount(): number {
    return Math.min(
      GameConfig.REEL_COUNT,
      this.reels.length || GameConfig.REEL_COUNT
    );
  }

  // ---------------------------------------------------------------------------
  // Spin Control
  // ---------------------------------------------------------------------------

  public spin(): void {
    this.ensureReelControllersInitialized();

    if (this.isSpinning) {
      if (this.debugLogs) console.log("[SlotMachine] Already spinning");
      return;
    }

    this.isSpinning = true;
    this.unschedule(() => void this.stopSpin());

    const targetSymbols = this.generateTargetSymbols();
    this.startReelSpins(targetSymbols);
    this.currentSymbols = targetSymbols;

    this.scheduleOnce(() => void this.stopSpin(), GameConfig.SPIN_DURATION);
    if (this.debugLogs) console.log("[SlotMachine] Spin started");
  }

  private generateTargetSymbols(): string[][] {
    const cols = this.getReelCount();
    const targetSymbols: string[][] = [];

    for (let col = 0; col < cols; col++) {
      const reelSymbols = this.generateReelSymbols();
      targetSymbols.push(reelSymbols);
    }

    return targetSymbols;
  }

  private generateReelSymbols(): string[] {
    const weights = GameConfig.SYMBOL_WEIGHTS;
    const symbols = Object.keys(weights);
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);
    const reelSymbols: string[] = [];

    for (let row = 0; row < GameConfig.SYMBOL_PER_REEL; row++) {
      const symbol = this.selectWeightedSymbol(symbols, weights, totalWeight);
      reelSymbols.push(symbol);
    }

    return reelSymbols;
  }

  private selectWeightedSymbol(
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

  private startReelSpins(targetSymbols: string[][]): void {
    targetSymbols.forEach((reelSymbols, col) => {
      this.reelControllers[col]?.spin(reelSymbols, 0);
    });
  }

  private async stopSpin(): Promise<void> {
    this.ensureReelControllersInitialized();

    await this.stopReelsSequentially();
    this.isSpinning = false;

    this.currentSymbols = this.buildSymbolGrid();
    GameManager.getInstance()?.onSpinComplete();
  }

  private async stopReelsSequentially(): Promise<void> {
    const cols = this.getReelCount();
    const stopPromises: Promise<void>[] = [];

    for (let col = 0; col < cols; col++) {
      const delayTime = col * GameConfig.REEL_STOP_DELAY;
      const stopPromise = this.createStopPromise(col, delayTime);
      stopPromises.push(stopPromise);
    }

    await Promise.all(stopPromises);
  }

  private createStopPromise(col: number, delay: number): Promise<void> {
    return new Promise<void>((resolve) => {
      this.scheduleOnce(() => {
        this.reelControllers[col]?.stop().then(() => resolve());
      }, delay);
    });
  }

  private buildSymbolGrid(): string[][] {
    const cols = this.getReelCount();
    const grid: string[][] = [];

    for (let col = 0; col < cols; col++) {
      const visible = this.reelControllers[col]?.getVisibleSymbols() || [];
      const colArr: string[] = [];

      for (let row = 0; row < GameConfig.SYMBOL_PER_REEL; row++) {
        colArr.push(visible[row] ?? "");
      }

      grid.push(colArr);
    }

    return grid;
  }

  // ---------------------------------------------------------------------------
  // Win Detection
  // ---------------------------------------------------------------------------

  public checkWin(): { totalWin: number; winLines: WinLine[] } {
    const winLines: WinLine[] = [];
    const cols = this.getReelCount();
    const rows = GameConfig.SYMBOL_PER_REEL;

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        const lines = this.checkWinFromPosition(col, row, cols, rows);
        winLines.push(...lines);
      }
    }

    const totalWin = winLines.reduce((sum, line) => sum + line.win, 0);
    return { totalWin, winLines };
  }

  private checkWinFromPosition(
    startCol: number,
    startRow: number,
    maxCols: number,
    maxRows: number
  ): WinLine[] {
    const winLines: WinLine[] = [];

    for (const direction of SlotMachine.WIN_DIRECTIONS) {
      const line = this.checkWinInDirection(
        startCol,
        startRow,
        direction,
        maxCols,
        maxRows
      );
      if (line) {
        winLines.push(line);
      }
    }

    return winLines;
  }

  private checkWinInDirection(
    startCol: number,
    startRow: number,
    direction: WinDirection,
    maxCols: number,
    maxRows: number
  ): WinLine | null {
    const { colDelta, rowDelta } = direction;
    const endCol = startCol + (SlotMachine.MIN_WIN_LENGTH - 1) * colDelta;
    const endRow = startRow + (SlotMachine.MIN_WIN_LENGTH - 1) * rowDelta;

    if (endCol < 0 || endCol >= maxCols || endRow < 0 || endRow >= maxRows) {
      return null;
    }

    const symbols = this.getSymbolsInLine(
      startCol,
      startRow,
      direction,
      SlotMachine.MIN_WIN_LENGTH
    );

    if (!this.isValidWinLine(symbols)) {
      return null;
    }

    const win = this.calculateWin(symbols[0]);
    if (win <= 0) {
      return null;
    }

    return this.createWinLine(
      symbols[0],
      startCol,
      startRow,
      direction,
      SlotMachine.MIN_WIN_LENGTH,
      win
    );
  }

  private getSymbolsInLine(
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
      const symbol = this.currentSymbols[col]?.[row] ?? "";
      symbols.push(symbol);
    }

    return symbols;
  }

  private isValidWinLine(symbols: string[]): boolean {
    if (symbols.length < SlotMachine.MIN_WIN_LENGTH) {
      return false;
    }

    const firstSymbol = symbols[0];
    if (!firstSymbol) {
      return false;
    }

    return symbols.every((symbol) => symbol === firstSymbol);
  }

  private calculateWin(symbol: string): number {
    const paytable = GameConfig.PAYTABLE[symbol];
    if (!paytable) {
      return 0;
    }

    const bet = GameManager.getInstance()?.getCurrentBet() || 1;
    const multiplier = paytable[SlotMachine.MIN_WIN_LENGTH];
    return multiplier ? multiplier * bet : 0;
  }

  private createWinLine(
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

  // ---------------------------------------------------------------------------
  // Win Display
  // ---------------------------------------------------------------------------

  public showWinLines(winLines: WinLine[]): void {
    if (!winLines?.length) return;

    const rowsByCol = this.groupWinPositionsByColumn(winLines);
    this.highlightWinSymbols(rowsByCol);
  }

  private groupWinPositionsByColumn(
    winLines: WinLine[]
  ): Map<number, Set<number>> {
    const rowsByCol = new Map<number, Set<number>>();

    winLines.forEach((line) => {
      line.positions.forEach((position) => {
        if (!rowsByCol.has(position.col)) {
          rowsByCol.set(position.col, new Set<number>());
        }
        rowsByCol.get(position.col)!.add(position.row);
      });
    });

    return rowsByCol;
  }

  private highlightWinSymbols(rowsByCol: Map<number, Set<number>>): void {
    rowsByCol.forEach((rowsSet, col) => {
      this.reelControllers[col]?.highlightWinSymbols(Array.from(rowsSet));
    });
  }
}
