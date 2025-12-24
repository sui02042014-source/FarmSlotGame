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

  private reelControllers: ReelController[] = [];
  private isSpinning: boolean = false;
  private currentSymbols: string[][] = [];
  private pendingSpinResult: SpinResult | null = null;

  // ============================================================================
  // Lifecycle
  // ============================================================================

  protected start(): void {
    this.reelControllers = this.reels
      .map((reel) => reel?.getComponent(ReelController))
      .filter(
        (controller): controller is ReelController => controller !== null
      );
  }

  // ============================================================================
  // Spin Control
  // ============================================================================

  public spin(): void {
    if (this.isSpinning || this.reelControllers.length === 0) {
      return;
    }

    this.isSpinning = true;
    this.unschedule(() => void this.stopSpin());

    const bet = GameManager.getInstance()?.getCurrentBet() || 1;
    this.pendingSpinResult = SlotLogic.calculateSpinResult(
      GameConfig.REEL_COUNT,
      GameConfig.SYMBOL_PER_REEL,
      bet
    );

    const targetSymbols = this.pendingSpinResult.symbolGrid;
    console.log("targetSymbols", targetSymbols);
    this.startReelSpins(targetSymbols);
    this.currentSymbols = targetSymbols;

    this.scheduleOnce(() => void this.stopSpin(), GameConfig.SPIN_DURATION);
  }

  private startReelSpins(targetSymbols: string[][]): void {
    targetSymbols.forEach((reelSymbols, col) => {
      this.reelControllers[col]?.spin(reelSymbols, 0);
    });
  }

  private async stopSpin(): Promise<void> {
    await this.stopReelsSequentially();
    this.isSpinning = false;

    this.currentSymbols = this.buildSymbolGrid();
    if (this.pendingSpinResult) {
      this.pendingSpinResult.symbolGrid = this.currentSymbols;
    }

    GameManager.getInstance()?.onSpinComplete();
  }

  private async stopReelsSequentially(): Promise<void> {
    const stopPromises = this.reelControllers
      .slice(0, GameConfig.REEL_COUNT)
      .map((controller, col) => {
        if (!controller) return Promise.resolve();

        return new Promise<void>((resolve) => {
          this.scheduleOnce(() => {
            controller.stop().then(() => resolve());
          }, col * GameConfig.REEL_STOP_DELAY);
        });
      });

    await Promise.all(stopPromises);
  }

  private buildSymbolGrid(): string[][] {
    return this.reelControllers
      .slice(0, GameConfig.REEL_COUNT)
      .map((controller) => controller?.getVisibleSymbols() || []);
  }

  // ============================================================================
  // Win Detection
  // ============================================================================

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

  // ============================================================================
  // Win Display
  // ============================================================================

  public showWinLines(winLines: WinLine[]): void {
    if (!winLines?.length) return;

    const rowsByCol = this.groupWinPositionsByColumn(winLines);
    this.highlightWinSymbols(rowsByCol);
  }

  private groupWinPositionsByColumn(
    winLines: WinLine[]
  ): Map<number, Set<number>> {
    const rowsByCol = new Map<number, Set<number>>();

    for (const line of winLines) {
      for (const position of line.positions) {
        if (!rowsByCol.has(position.col)) {
          rowsByCol.set(position.col, new Set<number>());
        }
        rowsByCol.get(position.col)!.add(position.row);
      }
    }

    return rowsByCol;
  }

  private highlightWinSymbols(rowsByCol: Map<number, Set<number>>): void {}
}
