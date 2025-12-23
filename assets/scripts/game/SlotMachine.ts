import { _decorator, Component, Node } from "cc";
import { GameConfig } from "../data/GameConfig";
import { ReelController } from "./ReelController";
import { GameManager } from "./GameManager";
import { SlotLogic, WinLine, SpinResult } from "../logic/SlotLogic";
const { ccclass, property } = _decorator;

export type { WinLine };

@ccclass("SlotMachine")
export class SlotMachine extends Component {
  @property([Node])
  reels: Node[] = [];

  private reelControllers: Array<ReelController | null> = [];
  private isSpinning: boolean = false;
  private currentSymbols: string[][] = [];
  private pendingSpinResult: SpinResult | null = null;
  private readonly debugLogs: boolean = false;

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

    const bet = GameManager.getInstance()?.getCurrentBet() || 1;
    this.pendingSpinResult = SlotLogic.calculateSpinResult(
      this.getReelCount(),
      GameConfig.SYMBOL_PER_REEL,
      bet
    );

    const targetSymbols = this.pendingSpinResult.symbolGrid;
    this.startReelSpins(targetSymbols);
    this.currentSymbols = targetSymbols;

    this.scheduleOnce(() => void this.stopSpin(), GameConfig.SPIN_DURATION);
    if (this.debugLogs) console.log("[SlotMachine] Spin started");
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
    if (this.pendingSpinResult) {
      this.pendingSpinResult.symbolGrid = this.currentSymbols;
    }
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
    if (this.pendingSpinResult) {
      return {
        totalWin: this.pendingSpinResult.totalWin,
        winLines: this.pendingSpinResult.winLines,
      };
    }

    const bet = GameManager.getInstance()?.getCurrentBet() || 1;
    return SlotLogic.checkWin(this.currentSymbols, bet);
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
