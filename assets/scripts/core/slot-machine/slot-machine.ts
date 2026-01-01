import { _decorator, Component, Node } from "cc";
import { ToastManager } from "../../components/toast/toast-manager";
import { GameConfig } from "../../data/config/game-config";
import { SlotService } from "../../services/slot-service";
import { SpinResult } from "../../types";
import { Logger } from "../../utils/helpers/logger";
import { GameManager } from "../game/game-manager";
import { ReelController } from "./reel-controller";
import { EventManager } from "../events/event-manager";

const { ccclass, property } = _decorator;

const logger = Logger.create("SlotMachine");

@ccclass("SlotMachine")
export class SlotMachine extends Component {
  @property([Node])
  reels: Node[] = [];

  private reelControllers: ReelController[] = [];
  private lastSpinResult: SpinResult | null = null;
  private finishedReelsCount: number = 0;
  private isSpinning: boolean = false;
  private reelStopCallbacks: Map<number, () => void> = new Map();

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

  public async initializeSlot(): Promise<void> {
    this.reelControllers = this.reels
      .map((reel) => reel.getComponent(ReelController))
      .filter((c): c is ReelController => !!c);

    try {
      const initPromises = this.reelControllers.map((controller) =>
        controller.initializeReel()
      );
      await Promise.all(initPromises);
    } catch (error) {
      logger.error("Failed to initialize slot reels:", error);
      throw error;
    }
  }

  public async spin(): Promise<void> {
    const gameManager = GameManager.getInstance();
    if (!gameManager || gameManager.isGamePaused()) {
      return;
    }

    if (this.isSpinning) {
      return;
    }

    this.isSpinning = true;
    this.finishedReelsCount = 0;
    this.cleanupReelCallbacks();

    const startDelay = 0.1;
    const minSpinTime = 1.0;

    this.reelControllers.forEach((controller, col) => {
      controller.startSpin([], col * startDelay);
    });

    const bet = gameManager.getCurrentBet();

    try {
      const result = await SlotService.getInstance().fetchSpinResult({
        bet,
        lines: GameConfig.DEFAULT_LINES,
      });

      const currentGameManager = GameManager.getInstance();
      if (
        !currentGameManager ||
        currentGameManager.isGamePaused() ||
        !this.node?.isValid
      ) {
        this.isSpinning = false;
        return;
      }

      this.lastSpinResult = result;

      this.reelControllers.forEach((controller, col) => {
        const reelStartDelay = col * startDelay;
        const stopDelay =
          reelStartDelay + minSpinTime + col * GameConfig.REEL_STOP_DELAY;

        this.scheduleOnce(() => {
          if (!controller?.node?.isValid) {
            this.handleReelStopped();
            return;
          }

          const callback = () => {
            this.reelStopCallbacks.delete(col);
            this.handleReelStopped();
          };

          this.reelStopCallbacks.set(col, callback);

          controller.node.once(GameConfig.EVENTS.REEL_STOPPED, callback);

          controller.stopSpin(result.symbolGrid[col]);
        }, stopDelay);
      });
    } catch (error) {
      logger.error("Failed to fetch spin result:", error);
      this.isSpinning = false;

      const currentGameManager = GameManager.getInstance();
      if (currentGameManager && !currentGameManager.isGamePaused()) {
        this.stopAllReels();

        currentGameManager.refundLastBet();

        currentGameManager.setState(GameConfig.GAME_STATES.IDLE);

        ToastManager.getInstance()?.show(
          "Connection error. Bet has been refunded."
        );
      }
    }
  }

  private handleReelStopped(): void {
    this.finishedReelsCount++;
    if (this.finishedReelsCount === this.reelControllers.length) {
      this.isSpinning = false;
      EventManager.emit(GameConfig.EVENTS.SPIN_COMPLETE);
    }
  }

  public stopAllReels(): void {
    this.unscheduleAllCallbacks();
    this.cleanupReelCallbacks();
    this.isSpinning = false;
    this.finishedReelsCount = 0;
    this.reelControllers.forEach((controller) => {
      if (controller) {
        controller.forceStop();
      }
    });
  }

  private cleanupReelCallbacks(): void {
    this.reelControllers.forEach((controller, col) => {
      if (controller?.node?.isValid) {
        const callback = this.reelStopCallbacks.get(col);
        if (callback) {
          controller.node.off(GameConfig.EVENTS.REEL_STOPPED, callback);
        }
      }
    });
    this.reelStopCallbacks.clear();
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
