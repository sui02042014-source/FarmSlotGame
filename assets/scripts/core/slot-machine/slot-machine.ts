import { _decorator, Component, Node, UITransform, Vec3 } from "cc";
import { ToastManager } from "../../components/toast/toast-manager";
import { GameConfig } from "../../data/config/game-config";
import { SlotService } from "../../services/slot-service";
import { WinLine, SpinResult } from "../../types";
import { GameManager } from "../game/game-manager";
import { ReelController } from "./reel-controller";
import { EventManager } from "../events/event-manager";
import { AudioManager } from "../audio/audio-manager";
import { Logger } from "../../utils/helpers/logger";
import { WinLineDrawer } from "../../utils/effects/win-line-drawer";

const { ccclass, property } = _decorator;
const logger = Logger.create("SlotMachine");

const SLOT_CONSTANTS = {
  SCATTER_ANTICIPATION_THRESHOLD: 2,
  EMPTY_WIN: { totalWin: 0, winLines: [] as WinLine[] },
} as const;

@ccclass("SlotMachine")
export class SlotMachine extends Component {
  @property([Node])
  reels: Node[] = [];

  // Reel management
  private reelControllers: ReelController[] = [];
  private reelStopCallbacks: Map<number, () => void> = new Map();
  private finishedReelsCount: number = 0;

  // Spin state
  private lastSpinResult: SpinResult | null = null;
  private currentSpinId: number = 0;
  private isSpinning: boolean = false;
  private spinLock: boolean = false;
  private isInitialized: boolean = false;

  // Anticipation state
  private isAnticipationActive: boolean = false;
  private scatterPositions: Array<{ col: number; row: number }> = [];

  // Cached manager instances
  private gameManager: GameManager | null = null;
  private audioManager: AudioManager | null = null;
  private toastManager: ToastManager | null = null;
  private slotService: SlotService | null = null;

  // Win line drawer
  private winLineDrawer: WinLineDrawer | null = null;

  // ==========================================
  // Lifecycle
  // ==========================================

  protected start(): void {
    if (!this.isInitialized) {
      this.cacheManagerInstances();
      this.setupReelControllers();
      this.initializeWinLineDrawer();
    }
  }

  protected onDestroy(): void {
    this.cleanup();
  }

  // ==========================================
  // Public API - Initialization
  // ==========================================

  public async initializeSlot(): Promise<void> {
    if (this.isInitialized) {
      logger.warn("SlotMachine already initialized, skipping");
      return;
    }

    this.cacheManagerInstances();
    this.setupReelControllers();

    const initPromises = this.reelControllers.map((controller) =>
      controller.initializeReel()
    );
    await Promise.all(initPromises);

    this.isInitialized = true;
  }

  // ==========================================
  // Public API - Spin Control
  // ==========================================

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

  public stopAllReels(): void {
    this.currentSpinId++;
    this.unscheduleAllCallbacks();
    this.stopAnticipationEffects();
    this.resetSpinState();

    this.reelControllers.forEach((controller) => {
      if (this.isControllerValid(controller)) {
        controller.forceStop();
      }
    });
  }

  // ==========================================
  // Public API - Win Checking
  // ==========================================

  public checkWin(): { totalWin: number; winLines: SpinResult["winLines"] } {
    if (!this.lastSpinResult) {
      return SLOT_CONSTANTS.EMPTY_WIN;
    }

    const { totalWin, winLines } = this.lastSpinResult;
    return { totalWin, winLines };
  }

  // ==========================================
  // Public API - Visual Effects
  // ==========================================

  public resetAllReels(): void {
    this.reelControllers.forEach((reel) => {
      if (this.isControllerValid(reel) && reel.resetSymbolsScale) {
        reel.resetSymbolsScale();
      }
    });

    if (this.winLineDrawer) {
      this.winLineDrawer.clearAllLines();
    }
  }

  public setBlurAll(enable: boolean): void {
    this.reelControllers.forEach((reel) => {
      if (this.isControllerValid(reel)) {
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
          if (this.isValidPosition(pos.col, pos.row)) {
            this.reelControllers[pos.col].highlightSymbol(pos.row);
          }
        });
      }
    });

    if (this.winLineDrawer) {
      this.winLineDrawer.drawWinLines(winLines, (col, row) =>
        this.getSymbolWorldPosition(col, row)
      );
    }
  }

  // ==========================================
  // Private - Initialization
  // ==========================================

  private cacheManagerInstances(): void {
    this.gameManager = GameManager.getInstance();
    this.audioManager = AudioManager.getInstance();
    this.toastManager = ToastManager.getInstance();
    this.slotService = SlotService.getInstance();
  }

  private setupReelControllers(): void {
    this.reelControllers = this.reels
      .map((reel) => reel.getComponent(ReelController))
      .filter((c): c is ReelController => !!c);
  }

  private initializeWinLineDrawer(): void {
    this.winLineDrawer = new WinLineDrawer(this.node);
  }

  // ==========================================
  // Private - Spin Mechanics
  // ==========================================

  private canStartSpin(): boolean {
    if (!this.gameManager || this.gameManager.isGamePaused()) {
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
      const startDelay = this.calculateStartDelay(col);
      controller.startSpin([], startDelay);
    });
  }

  private async fetchSpinResult(): Promise<SpinResult> {
    if (!this.gameManager) {
      throw new Error("GameManager not available");
    }

    if (!this.slotService) {
      throw new Error("SlotService not available");
    }

    const bet = this.gameManager.getCurrentBet();

    return await this.slotService.fetchSpinResult({
      bet,
      lines: GameConfig.DEFAULT_LINES,
    });
  }

  private isSpinStillValid(): boolean {
    if (
      !this.gameManager ||
      this.gameManager.isGamePaused() ||
      !this.node?.isValid
    ) {
      this.isSpinning = false;
      return false;
    }
    return true;
  }

  private scheduleReelStops(result: SpinResult): void {
    this.reelControllers.forEach((controller, col) => {
      const stopDelay = this.calculateStopDelay(col);

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
    if (!this.isControllerValid(controller)) {
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

  private handleReelStopped(): void {
    this.finishedReelsCount++;

    if (
      this.lastSpinResult &&
      this.finishedReelsCount < this.reelControllers.length
    ) {
      this.checkScatterAnticipation();
    }

    if (this.finishedReelsCount === this.reelControllers.length) {
      this.onAllReelsStopped();
    }
  }

  private onAllReelsStopped(): void {
    this.isSpinning = false;
    this.spinLock = false;
    this.stopAnticipationEffects();
    EventManager.emit(GameConfig.EVENTS.SPIN_COMPLETE);
  }

  // ==========================================
  // Private - Error Handling
  // ==========================================

  private handleSpinError(error: unknown): void {
    this.isSpinning = false;
    this.spinLock = false;
    logger.error("Spin error occurred:", error);

    if (this.shouldHandleSpinError()) {
      this.performSpinErrorRecovery();
    }
  }

  private shouldHandleSpinError(): boolean {
    return this.gameManager !== null && !this.gameManager.isGamePaused();
  }

  private performSpinErrorRecovery(): void {
    this.stopAllReels();

    if (this.gameManager) {
      this.gameManager.refundLastBet();
      this.gameManager.setState(GameConfig.GAME_STATES.IDLE);
    }

    this.toastManager?.show("Connection error. Bet has been refunded.");
  }

  // ==========================================
  // Private - Scatter Anticipation
  // ==========================================

  private checkScatterAnticipation(): void {
    if (!this.lastSpinResult || this.isAnticipationActive) return;

    this.collectScatterPositions();

    if (
      this.scatterPositions.length ===
      SLOT_CONSTANTS.SCATTER_ANTICIPATION_THRESHOLD
    ) {
      this.startAnticipationEffects();
    }
  }

  private collectScatterPositions(): void {
    const scatterSymbolId = GameConfig.SYMBOL_TYPES.SCATTER;
    this.scatterPositions = [];

    for (let col = 0; col < this.finishedReelsCount; col++) {
      const reelSymbols = this.lastSpinResult!.symbolGrid[col];
      for (let row = 0; row < reelSymbols.length; row++) {
        if (reelSymbols[row] === scatterSymbolId) {
          this.scatterPositions.push({ col, row });
        }
      }
    }
  }

  private startAnticipationEffects(): void {
    this.isAnticipationActive = true;

    this.playAnticipationSound();
    this.highlightScatterSymbols();
  }

  private playAnticipationSound(): void {
    if (this.audioManager) {
      this.audioManager.playSFX(GameConfig.SOUNDS.SCATTER_ANTICIPATION);
    }
  }

  private highlightScatterSymbols(): void {
    this.scatterPositions.forEach((pos) => {
      const controller = this.reelControllers[pos.col];
      if (this.isControllerValid(controller)) {
        controller.highlightSymbol(pos.row);
      }
    });
  }

  private stopAnticipationEffects(): void {
    if (!this.isAnticipationActive) return;

    this.isAnticipationActive = false;
    this.scatterPositions = [];
    this.resetAllReels();
    if (this.audioManager) {
      this.audioManager.stopSpinSound();
    }
  }

  // ==========================================
  // Private - Cleanup
  // ==========================================

  private cleanupReelCallbacks(): void {
    this.reelControllers.forEach((controller, col) => {
      if (this.isControllerValid(controller)) {
        const callback = this.reelStopCallbacks.get(col);
        if (callback) {
          controller.node.off(GameConfig.EVENTS.REEL_STOPPED, callback);
        }
      }
    });
    this.reelStopCallbacks.clear();
  }

  private resetSpinState(): void {
    this.cleanupReelCallbacks();
    this.isSpinning = false;
    this.spinLock = false;
    this.finishedReelsCount = 0;
  }

  private cleanup(): void {
    this.cleanupReelCallbacks();
    this.unscheduleAllCallbacks();
    this.stopAnticipationEffects();
    this.resetSpinState();
    this.scatterPositions = [];
    this.lastSpinResult = null;

    if (this.winLineDrawer) {
      this.winLineDrawer.destroy();
      this.winLineDrawer = null;
    }
  }

  // ==========================================
  // Private - Validation Helpers
  // ==========================================

  private isControllerValid(controller: ReelController | null): boolean {
    return controller !== null && controller.node?.isValid === true;
  }

  private isValidPosition(col: number, row: number): boolean {
    return (
      col >= 0 &&
      col < this.reelControllers.length &&
      row >= 0 &&
      row < GameConfig.SYMBOL_PER_REEL &&
      this.isControllerValid(this.reelControllers[col])
    );
  }

  private getSymbolWorldPosition(col: number, row: number): Vec3 | null {
    if (!this.isValidPosition(col, row)) {
      return null;
    }

    const controller = this.reelControllers[col];
    const container = controller.getContainerAtRow(row);

    if (!container || !container.node) {
      return null;
    }

    const worldPos = container.node.worldPosition;
    const transform = this.node.getComponent(UITransform);

    if (!transform) {
      return worldPos.clone();
    }

    return transform.convertToNodeSpaceAR(worldPos);
  }

  // ==========================================
  // Private - Calculation Helpers
  // ==========================================

  private calculateStartDelay(col: number): number {
    return col * GameConfig.REEL_PARAMS.START_DELAY;
  }

  private calculateStopDelay(col: number): number {
    const reelStartDelay = this.calculateStartDelay(col);
    const isTurbo = this.gameManager?.isTurbo() || false;
    const minSpinTime = isTurbo
      ? GameConfig.TURBO.SPIN_DURATION
      : GameConfig.REEL_PARAMS.MIN_SPIN_TIME;
    const reelStopDelay = isTurbo
      ? GameConfig.TURBO.REEL_STOP_DELAY
      : GameConfig.REEL_STOP_DELAY;
    return reelStartDelay + minSpinTime + col * reelStopDelay;
  }
}
