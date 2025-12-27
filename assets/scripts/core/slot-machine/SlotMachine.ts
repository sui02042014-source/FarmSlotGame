import { _decorator, Component, Node } from "cc";
import { GameConfig } from "../../data/config/GameConfig";
import { SlotLogic } from "../../logic/SlotLogic";
import { SpinResult } from "../../types";
import { GameManager } from "../game-manager/GameManager";
import { ReelController } from "./ReelController";

const { ccclass, property } = _decorator;

export interface WinLine {
  lineIndex: number;
  symbolId: string;
  count: number;
  positions: number[][];
}

@ccclass("SlotMachine")
export class SlotMachine extends Component {
  @property([Node])
  reels: Node[] = [];

  private reelControllers: ReelController[] = [];
  private lastSpinResult: SpinResult | null = null;

  // ==========================================
  // Lifecycle Methods
  // ==========================================

  protected start(): void {
    this.reelControllers = this.reels
      .map((reel) => reel.getComponent(ReelController))
      .filter((c): c is ReelController => !!c);
  }

  // ==========================================
  // Public API - Spin Control
  // ==========================================

  public initializeSlot(): void {
    this.reelControllers = this.reels
      .map((reel) => reel.getComponent(ReelController))
      .filter((c): c is ReelController => !!c);

    this.reelControllers.forEach((controller) => {
      controller.initializeReel();
    });
  }

  public spin(): void {
    const bet = GameManager.getInstance().getCurrentBet();
    const result = SlotLogic.calculateSpinResult(
      GameConfig.REEL_COUNT,
      GameConfig.SYMBOL_PER_REEL,
      bet
    );

    this.lastSpinResult = result;

    let finishedReels = 0;
    this.reelControllers.forEach((controller, col) => {
      controller.startSpin(result.symbolGrid[col], col * 0.1);

      controller.node.once("REEL_STOPPED", () => {
        finishedReels++;
        if (finishedReels === this.reelControllers.length) {
          GameManager.getInstance().onSpinComplete();
        }
      });
    });

    this.scheduleOnce(() => {
      this.reelControllers.forEach((c, i) => {
        this.scheduleOnce(() => c.stopSpin(), i * 0.2);
      });
    }, 2.5);
  }

  // ==========================================
  // Public API - Win Checking
  // ==========================================

  public checkWin(): { totalWin: number; winLines: SpinResult["winLines"] } {
    if (!this.lastSpinResult) {
      return { totalWin: 0, winLines: [] };
    }
    return {
      totalWin: this.lastSpinResult.totalWin,
      winLines: this.lastSpinResult.winLines,
    };
  }

  // ==========================================
  // Public API - Visual Effects
  // ==========================================

  public resetAllReels(): void {
    this.reelControllers.forEach((reel) => {
      if (reel && reel.resetSymbolsScale) {
        reel.resetSymbolsScale();
      }
    });
  }

  public showWinEffects(winLines: any[]): void {
    this.resetAllReels();

    if (!winLines || winLines.length === 0) return;

    winLines.forEach((line) => {
      const positions = line.positions || line;

      if (Array.isArray(positions)) {
        positions.forEach((pos: any) => {
          const col = typeof pos.col !== "undefined" ? pos.col : pos[0];
          const row = typeof pos.row !== "undefined" ? pos.row : pos[1];

          if (this.reelControllers[col]) {
            this.reelControllers[col].highlightSymbol(row);
          }
        });
      }
    });
  }
}
