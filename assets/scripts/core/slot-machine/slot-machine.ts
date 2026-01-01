import { _decorator, Component, Node } from "cc";
import { ToastManager } from "../../components/toast/toast-manager";
import { GameConfig } from "../../data/config/game-config";
import { SlotService } from "../../services/slot-service";
import { WinLine, SpinResult } from "../../types";
import { GameManager } from "../game/game-manager";
import { ReelController } from "./reel-controller";
import { EventManager } from "../events/event-manager";
import { AudioManager } from "../audio/audio-manager";
import { Logger } from "../../utils/helpers/logger";

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
  private isAnticipationActive: boolean = false;
  private scatterPositions: Array<{ col: number; row: number }> = [];
  private currentSpinId: number = 0;
  private spinLock: boolean = false;
  private isInitialized: boolean = false;

  // ==========================================
  // Lifecycle Methods
  // ==========================================

  protected start(): void {
    if (!this.isInitialized) {
      this.setupReelControllers();
    }
  }

  protected onDestroy(): void {
    this.cleanupReelCallbacks();
    this.unscheduleAllCallbacks();
    this.stopAnticipationEffects();
    this.isSpinning = false;
    this.spinLock = false;
    this.isAnticipationActive = false;
    this.scatterPositions = [];
  }

  // ==========================================
  // Public API - Spin Control
  // ==========================================

  public async initializeSlot(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("SlotMachine already initialized, skipping");
      return;
    }

    this.setupReelControllers();

    const initPromises = this.reelControllers.map((controller) =>
      controller.initializeReel()
    );
    await Promise.all(initPromises);

    this.isInitialized = true;
  }

  private setupReelControllers(): void {
    this.reelControllers = this.reels
      .map((reel) => reel.getComponent(ReelController))
      .filter((c): c is ReelController => !!c);
  }

  public async spin(): Promise<void> {
    if (this.spinLock) {
      logger.warn("Spin already in progress, ignoring duplicate request");
      return;
    }

    if (!this.canStartSpin()) {
      return;
    }

    this.spinLock = true;
    this.currentSpinId++;
    const thisSpinId = this.currentSpinId;

    try {
      this.initializeSpin();
      this.startReelSpinning();

      const result = await this.fetchSpinResult();

      if (thisSpinId !== this.currentSpinId || !this.isSpinStillValid()) {
        return;
      }

      this.lastSpinResult = result;
      this.scheduleReelStops(result);
    } catch (error) {
      this.spinLock = false;
      if (thisSpinId === this.currentSpinId) {
        this.handleSpinError(error);
      }
    }
  }

  // ==========================================
  // Private Spin Helper Methods
  // ==========================================

  private canStartSpin(): boolean {
    const gameManager = GameManager.getInstance();
    if (!gameManager || gameManager.isGamePaused()) {
      return false;
    }
    if (this.isSpinning) {
      return false;
    }
    return true;
  }

  private initializeSpin(): void {
    this.isSpinning = true;
    this.finishedReelsCount = 0;
    this.cleanupReelCallbacks();
  }

  private startReelSpinning(): void {
    this.reelControllers.forEach((controller, col) => {
      controller.startSpin([], col * GameConfig.REEL_PARAMS.START_DELAY);
    });
  }

  private async fetchSpinResult(): Promise<SpinResult> {
    const gameManager = GameManager.getInstance();
    if (!gameManager) {
      throw new Error("GameManager not available");
    }
    const bet = gameManager.getCurrentBet();

    return await SlotService.getInstance().fetchSpinResult({
      bet,
      lines: GameConfig.DEFAULT_LINES,
    });
  }

  private isSpinStillValid(): boolean {
    const currentGameManager = GameManager.getInstance();
    if (
      !currentGameManager ||
      currentGameManager.isGamePaused() ||
      !this.node?.isValid
    ) {
      this.isSpinning = false;
      return false;
    }
    return true;
  }

  private scheduleReelStops(result: SpinResult): void {
    this.reelControllers.forEach((controller, col) => {
      const reelStartDelay = col * GameConfig.REEL_PARAMS.START_DELAY;
      const stopDelay =
        reelStartDelay +
        GameConfig.REEL_PARAMS.MIN_SPIN_TIME +
        col * GameConfig.REEL_STOP_DELAY;

      this.scheduleOnce(() => {
        this.stopReelAtColumn(controller, col, result);
      }, stopDelay);
    });
  }

  private stopReelAtColumn(
    controller: ReelController,
    col: number,
    result: SpinResult
  ): void {
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
  }

  private handleSpinError(error: unknown): void {
    this.isSpinning = false;
    this.spinLock = false;
    logger.error("Spin error occurred:", error);

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

  private handleReelStopped(): void {
    this.finishedReelsCount++;

    if (
      this.lastSpinResult &&
      this.finishedReelsCount < this.reelControllers.length
    ) {
      this.checkScatterAnticipation();
    }

    if (this.finishedReelsCount === this.reelControllers.length) {
      this.isSpinning = false;
      this.spinLock = false;
      this.stopAnticipationEffects();
      EventManager.emit(GameConfig.EVENTS.SPIN_COMPLETE);
    }
  }

  // ==========================================
  // Scatter Anticipation System
  // ==========================================

  private checkScatterAnticipation(): void {
    if (!this.lastSpinResult || this.isAnticipationActive) return;

    const scatterSymbolId = GameConfig.SYMBOL_TYPES.SCATTER;
    this.scatterPositions = [];

    for (let col = 0; col < this.finishedReelsCount; col++) {
      const reelSymbols = this.lastSpinResult.symbolGrid[col];
      for (let row = 0; row < reelSymbols.length; row++) {
        if (reelSymbols[row] === scatterSymbolId) {
          this.scatterPositions.push({ col, row });
        }
      }
    }

    if (this.scatterPositions.length === 2) {
      this.startAnticipationEffects();
    }
  }

  private startAnticipationEffects(): void {
    this.isAnticipationActive = true;

    // Play anticipation sound (looping)
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX(GameConfig.SOUNDS.SCATTER_ANTICIPATION);
    }

    this.scatterPositions.forEach((pos) => {
      const controller = this.reelControllers[pos.col];
      if (controller) {
        controller.highlightSymbol(pos.row);
      }
    });
  }

  private stopAnticipationEffects(): void {
    if (!this.isAnticipationActive) return;

    this.isAnticipationActive = false;
    this.scatterPositions = [];

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.stopSpinSound();
    }
  }

  public stopAllReels(): void {
    this.currentSpinId++;

    this.unscheduleAllCallbacks();
    this.cleanupReelCallbacks();
    this.isSpinning = false;
    this.spinLock = false;
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

  public showWinEffects(winLines: WinLine[]): void {
    this.resetAllReels();

    if (!winLines || winLines.length === 0) return;

    winLines.forEach((line) => {
      if (line.positions && Array.isArray(line.positions)) {
        line.positions.forEach((pos) => {
          if (this.reelControllers[pos.col]) {
            this.reelControllers[pos.col].highlightSymbol(pos.row);
          }
        });
      }
    });
  }
}
