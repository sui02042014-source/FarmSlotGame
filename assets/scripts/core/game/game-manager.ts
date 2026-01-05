import {
  _decorator,
  Component,
  game,
  Label,
  Node,
  tween,
  UITransform,
  Vec2,
  Vec3,
  Widget,
} from "cc";
import { ModalManager } from "../../components/modals/modal-manager";
import { SpinButtonController } from "../../components/spin-button/spin-button-controller";
import { ToastManager } from "../../components/toast/toast-manager";
import { GameConfig, GameState } from "../../data/config/game-config";
import { WalletService } from "../../services/wallet-service";
import { CoinFlyEffect } from "../../utils/effects/coin-fly-effect";
import { CoinRainEffect } from "../../utils/effects/coin-rain-effect";
import { Logger } from "../../utils/helpers/logger";
import { NumberCounter } from "../../utils/helpers/number-counter";
import { AudioManager } from "../audio/audio-manager";
import { EventManager } from "../events/event-manager";
import { SlotMachine } from "../slot-machine/slot-machine";

const { ccclass, property } = _decorator;
const logger = Logger.create("GameManager");

const GAME_CONSTANTS = {
  COIN_LABEL_LEFT_OFFSET: 100,
  COIN_FLY_DELAY: 0.5,
  COIN_ICON_SCALE_UP: 1.2,
  COIN_ICON_SCALE_DURATION: 0.1,
} as const;

@ccclass("GameManager")
export class GameManager extends Component {
  @property(Node)
  slotMachine: Node = null!;

  @property(Label)
  coinLabel: Label = null!;

  @property(Node)
  coinIconNode: Node = null!;

  @property(Label)
  betLabel: Label = null!;

  @property(Label)
  winLabel: Label = null!;

  @property(Node)
  winLabelNode: Node = null!;

  @property(Node)
  spinButton: SpinButtonController = null!;

  // Services & managers (cached)
  private walletService: WalletService = null!;
  private audioManager: AudioManager | null = null;
  private toastManager: ToastManager | null = null;
  private modalManager: ModalManager | null = null;
  private slotMachineComponent: SlotMachine | null = null;

  // Game state
  private currentState: GameState = GameConfig.GAME_STATES.IDLE;
  private lastWin: number = 0;
  private lastBetAmount: number = 0;
  private isAutoPlay: boolean = false;
  private isPaused: boolean = false;
  private isTurboMode: boolean = false;

  // UI components
  private winCounter: NumberCounter = null!;

  // FPS management
  private isLowFPS: boolean = false;
  private idleCallback = (): void => {
    if (this.shouldReduceFPS()) {
      this.setFPS(GameConfig.GAMEPLAY.IDLE_FPS);
    }
  };

  private static instance: GameManager = null!;

  // ==========================================
  // Lifecycle
  // ==========================================

  public static getInstance(): GameManager {
    return this.instance;
  }

  protected async onLoad(): Promise<void> {
    if (!this.initializeSingleton()) {
      return;
    }

    this.node.on(Node.EventType.TOUCH_START, this.resetIdleTime, this);

    try {
      await this.initGame();
      this.setupEventListeners();
    } catch (error) {
      logger.error("Failed to initialize game:", error);
      this.handleInitializationError();
    }
  }

  protected onDestroy(): void {
    this.cleanup();
  }

  // ==========================================
  // Initialization
  // ==========================================

  private initializeSingleton(): boolean {
    if (GameManager.instance && GameManager.instance !== this) {
      this.node.destroy();
      return false;
    }

    GameManager.instance = this;
    return true;
  }

  private async initGame(): Promise<void> {
    await this.initializeServices();
    await this.initializeSlotMachine();
    this.setupUI();
    this.setState(GameConfig.GAME_STATES.IDLE);
  }

  private async initializeServices(): Promise<void> {
    this.walletService = WalletService.getInstance();
    await this.walletService.init();

    this.audioManager = AudioManager.getInstance();
    this.toastManager = ToastManager.getInstance();
    this.modalManager = ModalManager.getInstance();
  }

  private async initializeSlotMachine(): Promise<void> {
    this.slotMachineComponent = this.getSlotMachine();
    if (this.slotMachineComponent) {
      await this.slotMachineComponent.initializeSlot();
    }
  }

  private setupUI(): void {
    this.setupWinCounter();
    this.setupCoinAmountLayout();
    this.updateAllDisplays();
  }

  private setupEventListeners(): void {
    EventManager.off(
      GameConfig.EVENTS.SPIN_COMPLETE,
      this.onSpinComplete,
      this
    );
    EventManager.on(GameConfig.EVENTS.SPIN_COMPLETE, this.onSpinComplete, this);
  }

  private setupWinCounter(): void {
    if (!this.winLabelNode) return;

    this.winCounter =
      this.winLabelNode.getComponent(NumberCounter) ||
      this.winLabelNode.addComponent(NumberCounter);

    if (this.winCounter) {
      this.winCounter.label = this.winLabel;
      this.winCounter.duration = this.getTiming(
        GameConfig.ANIM.NUMBER_COUNT_DURATION,
        GameConfig.TURBO.NUMBER_COUNT_DURATION
      );
      this.winCounter.decimalPlaces = 2;
    }
  }

  private setupCoinAmountLayout(): void {
    if (!this.coinLabel) return;

    const coinNode = this.coinLabel.node;
    const uiTrans = coinNode.getComponent(UITransform);
    if (!uiTrans) return;

    uiTrans.setAnchorPoint(new Vec2(0, 0.5));

    const widget =
      coinNode.getComponent(Widget) || coinNode.addComponent(Widget);
    widget.isAlignLeft = true;
    widget.left = GAME_CONSTANTS.COIN_LABEL_LEFT_OFFSET;
    widget.updateAlignment();

    this.coinLabel.updateRenderData(true);
  }

  // ==========================================
  // State Management
  // ==========================================

  public setState(state: GameState): void {
    const oldState = this.currentState;
    this.currentState = state;

    this.handleStateTransitionAudio(oldState, state);
    this.updateSpinButtonsInteractable();
    this.handleFPSOptimization(state, oldState);
  }

  private handleStateTransitionAudio(
    oldState: GameState,
    newState: GameState
  ): void {
    const wasSpinning = oldState === GameConfig.GAME_STATES.SPINNING;
    const isSpinning = newState === GameConfig.GAME_STATES.SPINNING;

    if (wasSpinning && !isSpinning) {
      this.audioManager?.stopSpinSound();
    }

    if (!wasSpinning && isSpinning) {
      this.audioManager?.playSpinSound(GameConfig.SOUNDS.SPIN);
    }
  }

  private handleFPSOptimization(
    newState: GameState,
    oldState: GameState
  ): void {
    if (newState === GameConfig.GAME_STATES.IDLE && !this.isAutoPlay) {
      this.scheduleIdleFPSReduction();
    } else if (oldState === GameConfig.GAME_STATES.IDLE) {
      this.resetIdleTime();
    }
  }

  public getState(): GameState {
    return this.currentState;
  }

  public isIdle(): boolean {
    return this.currentState === GameConfig.GAME_STATES.IDLE;
  }

  private updateSpinButtonsInteractable(): void {
    const canSpin = this.isIdle();

    if (this.spinButton?.isValid) {
      this.spinButton.setEnabled(canSpin);
    }
  }

  // ==========================================
  // FPS Management
  // ==========================================

  private shouldReduceFPS(): boolean {
    return (
      this.currentState === GameConfig.GAME_STATES.IDLE &&
      !this.isAutoPlay &&
      !this.isLowFPS
    );
  }

  private scheduleIdleFPSReduction(): void {
    this.cancelIdleFPSReduction();
    this.scheduleOnce(
      this.idleCallback,
      GameConfig.GAMEPLAY.IDLE_FPS_THRESHOLD
    );
  }

  private cancelIdleFPSReduction(): void {
    this.unschedule(this.idleCallback);
  }

  private resetIdleTime(): void {
    this.cancelIdleFPSReduction();

    if (this.isLowFPS) {
      this.setFPS(GameConfig.GAMEPLAY.ACTIVE_FPS);
    }

    if (this.currentState === GameConfig.GAME_STATES.IDLE && !this.isAutoPlay) {
      this.scheduleIdleFPSReduction();
    }
  }

  private setFPS(fps: number): void {
    game.frameRate = fps;
    this.isLowFPS = fps <= GameConfig.GAMEPLAY.IDLE_FPS;
  }

  // ==========================================
  // Bet Controls
  // ==========================================

  public increaseBet(): void {
    if (!this.isIdle()) return;
    this.walletService.increaseBet();
    this.updateBetDisplay();
  }

  public decreaseBet(): void {
    if (!this.isIdle()) return;
    this.walletService.decreaseBet();
    this.updateBetDisplay();
  }

  public setMaxBet(): void {
    if (!this.isIdle()) return;
    this.walletService.setMaxBet();
    this.updateBetDisplay();
  }

  // ==========================================
  // Spin Flow
  // ==========================================

  public startSpin(): void {
    if (!this.canStartSpin()) {
      return;
    }

    const betAmount = this.walletService.currentBet;

    if (!this.walletService.canAfford(betAmount)) {
      this.handleInsufficientCoins();
      return;
    }

    if (!this.deductBet(betAmount)) {
      return;
    }

    this.executeSpin();
  }

  private canStartSpin(): boolean {
    if (this.modalManager?.isAnyModalActive()) {
      return false;
    }

    if (this.isPaused || !this.isIdle()) {
      return false;
    }

    return true;
  }

  private deductBet(betAmount: number): boolean {
    const deducted = this.walletService.deductCoins(betAmount);

    if (!deducted) {
      logger.error("Failed to deduct coins for spin");
      this.toastManager?.show("Failed to place bet. Please try again.");
      return false;
    }

    this.lastBetAmount = betAmount;
    this.lastWin = 0;
    return true;
  }

  private executeSpin(): void {
    this.updateAllDisplays();
    this.setState(GameConfig.GAME_STATES.SPINNING);

    if (this.slotMachineComponent) {
      this.slotMachineComponent.resetAllReels();
      this.slotMachineComponent.spin();
    }
  }

  public onSpinComplete(): void {
    this.setState(GameConfig.GAME_STATES.STOPPING);

    if (!this.slotMachineComponent) {
      this.setState(GameConfig.GAME_STATES.IDLE);
      return;
    }

    const winResult = this.slotMachineComponent.checkWin();
    this.handleWinResult(winResult.totalWin, winResult.winLines);
  }

  private getSlotMachine(): SlotMachine | null {
    if (!this.slotMachine?.isValid) return null;
    return this.slotMachine.getComponent(SlotMachine);
  }

  // ==========================================
  // Win / Lose Handling
  // ==========================================

  private handleWinResult(totalWin: number, winLines: any[]): void {
    if (totalWin > 0) {
      if (this.slotMachineComponent) {
        this.slotMachineComponent.showWinEffects(winLines);
      }
      this.onWin(totalWin);
    } else {
      this.onLose();
    }
  }

  private onWin(amount: number): void {
    this.setState(GameConfig.GAME_STATES.WIN_SHOW);
    this.lastWin = amount;

    this.walletService.completeBetTransaction(amount);
    this.walletService.addCoins(amount);

    this.animateWinCounter(amount);
    this.playWinSound();
    this.updateAllDisplays();
    this.handleWinPresentation(amount);

    this.scheduleOnce(() => {
      this.setState(GameConfig.GAME_STATES.IDLE);
      this.continueAutoPlay();
    }, this.getTiming(GameConfig.EFFECTS.WIN_SHOW_DURATION, GameConfig.TURBO.WIN_SHOW_DURATION));
  }

  private animateWinCounter(amount: number): void {
    if (this.winCounter) {
      this.winCounter.setValue(0);
      const duration = this.getTiming(
        GameConfig.ANIM.NUMBER_COUNT_DURATION,
        GameConfig.TURBO.NUMBER_COUNT_DURATION
      );
      this.winCounter.countTo(amount, duration);
    }
  }

  private playWinSound(): void {
    this.audioManager?.playSFX(GameConfig.SOUNDS.WIN);
  }

  private onLose(): void {
    this.walletService.completeBetTransaction(0);
    this.audioManager?.playSFX(GameConfig.SOUNDS.LOSE);
    this.setState(GameConfig.GAME_STATES.IDLE);
    this.continueAutoPlay();
  }

  // ==========================================
  // Win Presentation
  // ==========================================

  private handleWinPresentation(amount: number): void {
    if (this.shouldShowWinModal(amount) && this.modalManager) {
      const delay = Math.max(GameConfig.ANIM.WIN_POPUP_DELAY ?? 0, 0);
      this.scheduleOnce(() => this.showWinModal(amount), delay);
    } else {
      this.scheduleOnce(
        () => this.playCoinFlyEffect(),
        GAME_CONSTANTS.COIN_FLY_DELAY
      );
    }
  }

  private shouldShowWinModal(amount: number): boolean {
    return amount >= GameConfig.GAMEPLAY.BIG_WIN_THRESHOLD;
  }

  private showWinModal(amount: number): void {
    this.modalManager?.showWinModal(amount, this.walletService.currentBet);
  }

  private playCoinFlyEffect(): void {
    const canvas = this.getCanvasNode();

    if (!this.canPlayCoinFlyEffect(canvas)) {
      return;
    }

    const flyDuration = this.getTiming(
      GameConfig.ANIM.COIN_FLY_DURATION,
      GameConfig.TURBO.COIN_FLY_DURATION
    );

    CoinFlyEffect.play({
      parent: canvas!,
      fromNode: this.winLabelNode,
      toNode: this.coinIconNode,
      coinCount: GameConfig.EFFECTS.COIN_FLY_COUNT,
      scatterRadius: GameConfig.EFFECTS.COIN_SCATTER_RADIUS,
      coinSize: GameConfig.EFFECTS.COIN_SIZE,
      flyDuration,
      onAllArrive: () => this.animateCoinIcon(),
    });
  }

  private getCanvasNode(): Node | undefined {
    const scene = this.node.scene;
    const canvasNode = scene?.getComponentInChildren("cc.Canvas")?.node;
    if (canvasNode) return canvasNode;

    const namedCanvas = scene?.getChildByName("Canvas");
    return namedCanvas || undefined;
  }

  private canPlayCoinFlyEffect(canvas: Node | undefined): boolean {
    return !!(
      canvas &&
      this.winLabelNode?.isValid &&
      this.coinIconNode?.isValid
    );
  }

  private animateCoinIcon(): void {
    if (!this.coinIconNode?.isValid) return;

    const scaleUp = GAME_CONSTANTS.COIN_ICON_SCALE_UP;
    const duration = GAME_CONSTANTS.COIN_ICON_SCALE_DURATION;

    tween(this.coinIconNode)
      .to(duration, { scale: new Vec3(scaleUp, scaleUp, 1) })
      .to(duration, { scale: new Vec3(1, 1, 1) })
      .start();
  }

  // ==========================================
  // Auto Play
  // ==========================================

  private continueAutoPlay(): void {
    if (this.isAutoPlay && !this.isPaused) {
      const delay = this.getTiming(
        GameConfig.GAMEPLAY.AUTO_PLAY_DELAY,
        GameConfig.TURBO.AUTO_PLAY_DELAY
      );
      this.scheduleOnce(this.onAutoPlaySpin, delay);
    }
  }

  private onAutoPlaySpin = (): void => {
    if (this.isAutoPlay && this.isIdle() && !this.isPaused) {
      this.startSpin();
    }
  };

  public toggleAutoPlay(): void {
    this.isAutoPlay = !this.isAutoPlay;

    if (!this.isAutoPlay) {
      this.stopAutoPlay();
    } else if (this.isIdle()) {
      this.startSpin();
    }
  }

  private stopAutoPlay(): void {
    this.unschedule(this.onAutoPlaySpin);
  }

  public isAutoPlayActive(): boolean {
    return this.isAutoPlay;
  }

  // ==========================================
  // UI Updates
  // ==========================================

  private updateAllDisplays(): void {
    this.updateCoinDisplay();
    this.updateBetDisplay();
    this.updateWinDisplay();
  }

  private updateCoinDisplay(): void {
    if (this.coinLabel) {
      this.coinLabel.string = this.walletService.coins.toFixed(2);
    }
  }

  private updateBetDisplay(): void {
    if (this.betLabel) {
      this.betLabel.string = this.walletService.currentBet.toFixed(2);
    }
  }

  private updateWinDisplay(): void {
    if (this.winLabel) {
      this.winLabel.string = this.lastWin.toFixed(2);
    }
  }

  // ==========================================
  // Public API
  // ==========================================

  public addCoins(amount: number): void {
    this.walletService.addCoins(amount);
    this.updateCoinDisplay();
  }

  public refundLastBet(): void {
    const refunded = this.walletService.refundPendingTransaction();

    if (refunded) {
      this.lastBetAmount = 0;
      this.updateAllDisplays();
      logger.info("Refunded bet amount due to spin failure");
    } else if (this.lastBetAmount > 0) {
      this.walletService.addCoins(this.lastBetAmount);
      this.lastBetAmount = 0;
      this.updateAllDisplays();
      logger.info("Refunded bet amount (fallback) due to spin failure");
    }
  }

  public getCurrentBet(): number {
    return this.walletService.currentBet;
  }

  public getPlayerCoins(): number {
    return this.walletService.coins;
  }

  // ==========================================
  // Turbo Mode
  // ==========================================

  public toggleTurboMode(): void {
    this.isTurboMode = !this.isTurboMode;
  }

  public isTurbo(): boolean {
    return this.isTurboMode;
  }

  public getTiming(normalValue: number, turboValue: number): number {
    return this.isTurboMode ? turboValue : normalValue;
  }

  // ==========================================
  // Pause / Resume
  // ==========================================

  public pauseGame(): void {
    this.isPaused = true;
    this.unscheduleAllCallbacks();

    const wasSpinning = this.currentState === GameConfig.GAME_STATES.SPINNING;

    if (this.audioManager) {
      if (wasSpinning) {
        this.audioManager.stopSpinSound();
        this.audioManager.pauseAll();
      } else {
        this.audioManager.pauseAll();
      }
    }

    if (this.slotMachineComponent) {
      this.slotMachineComponent.stopAllReels();
      this.slotMachineComponent.setBlurAll(true);
    }

    if (wasSpinning) {
      this.refundLastBet();
      this.currentState = GameConfig.GAME_STATES.IDLE;
      this.updateSpinButtonsInteractable();
    }
  }

  public resumeGame(): void {
    this.isPaused = false;

    // Only resume BGM, not spin sound (spin sound will start when actually spinning)
    if (this.audioManager) {
      this.audioManager.resumeAll();
    }

    if (this.slotMachineComponent) {
      this.slotMachineComponent.setBlurAll(false);
    }

    // If auto-play is active and game is idle, start spinning immediately
    if (this.isAutoPlay && this.isIdle()) {
      this.startSpin();
    }
  }

  public isGamePaused(): boolean {
    return this.isPaused;
  }

  // ==========================================
  // Error Handling
  // ==========================================

  private handleInsufficientCoins(): void {
    if (this.isAutoPlay) {
      this.isAutoPlay = false;
      this.stopAutoPlay();
      logger.info("Auto-play stopped due to insufficient coins");
    }

    const freeCoins =
      GameConfig.DEFAULT_COINS * GameConfig.FREE_COINS_MULTIPLIER;

    this.toastManager?.show(
      `Not enough coins! Added ${freeCoins.toFixed(2)} free coins!`,
      3.0
    );

    this.walletService.addCoins(freeCoins);
    this.updateCoinDisplay();
  }

  private handleInitializationError(): void {
    this.toastManager?.show("Failed to initialize game. Please refresh.", 5.0);

    if (GameManager.instance === this) {
      GameManager.instance = null!;
    }
  }

  // ==========================================
  // Cleanup
  // ==========================================

  private cleanup(): void {
    if (GameManager.instance === this) {
      GameManager.instance = null!;
    }

    this.cancelIdleFPSReduction();
    CoinFlyEffect.clearPool();
    CoinRainEffect.clear();

    EventManager.off(
      GameConfig.EVENTS.SPIN_COMPLETE,
      this.onSpinComplete,
      this
    );
  }
}
