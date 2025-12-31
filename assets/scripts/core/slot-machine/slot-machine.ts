import { _decorator, Component, Node } from "cc";
import { ToastManager } from "../../components/toast/toast-manager";
import { GameConfig } from "../../data/config/game-config";
import { SlotService } from "../../services/slot-service";
import { SpinResult } from "../../types";
import { GameManager } from "../game/game-manager";
import { ReelController } from "./reel-controller";

const { ccclass, property } = _decorator;

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

  public async spin(): Promise<void> {
    const gameManager = GameManager.getInstance();
    if (gameManager?.isGamePaused()) {
      return;
    }

    this.reelControllers.forEach((controller, col) => {
      controller.startSpin([], col * 0.1);
    });

    const bet = gameManager.getCurrentBet();

    try {
      const result = await SlotService.getInstance().fetchSpinResult({
        bet,
        lines: 20,
      });

      if (!gameManager || gameManager.isGamePaused()) {
        console.log("[SlotMachine] Game paused during spin result fetch");
        return;
      }

      this.lastSpinResult = result;

      let finishedReels = 0;
      this.reelControllers.forEach((controller, col) => {
        this.scheduleOnce(() => {
          if (!controller?.node?.isValid) {
            console.warn(
              `[SlotMachine] Controller ${col} is invalid, skipping stop`
            );
            return;
          }

          controller.stopSpin(result.symbolGrid[col]);

          controller.node.once("REEL_STOPPED", () => {
            finishedReels++;
            if (finishedReels === this.reelControllers.length) {
              const gm = GameManager.getInstance();
              if (gm && !gm.isGamePaused()) {
                gm.onSpinComplete();
              }
            }
          });
        }, col * 0.2);
      });
    } catch (error) {
      console.error("[SlotMachine] Failed to fetch spin result:", error);

      if (gameManager && !gameManager.isGamePaused()) {
        this.stopAllReels();

        gameManager.addCoins(bet);
        gameManager.setState(GameConfig.GAME_STATES.IDLE);

        ToastManager.getInstance()?.show("Connection error. Bet refunded.");
      }
    }
  }

  public stopAllReels(): void {
    this.unscheduleAllCallbacks();
    this.reelControllers.forEach((controller) => {
      if (controller) {
        controller.forceStop();
      }
    });
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

  public setBlurAll(enable: boolean): void {
    this.reelControllers.forEach((reel) => {
      if (reel) {
        reel.setBlur(enable);
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
