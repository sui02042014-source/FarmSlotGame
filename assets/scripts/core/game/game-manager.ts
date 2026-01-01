import {
  _decorator,
  Component,
  game,
  Label,
  Node,
  SpriteFrame,
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
import { SpriteFrameCache } from "../../utils/helpers/sprite-frame-cache";
import { AssetBundleManager, BundleName } from "../assets/asset-bundle-manager";
import { AudioManager } from "../audio/audio-manager";
import { EventManager } from "../events/event-manager";
import { SlotMachine } from "../slot-machine/slot-machine";

const { ccclass, property } = _decorator;

const logger = Logger.create("GameManager");

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

  private walletService: WalletService = null!;
  private currentState: GameState = GameConfig.GAME_STATES.IDLE;
  private stateBeforePause: GameState | null = null;
  private lastWin: number = 0;
  private isAutoPlay: boolean = false;
  private isPaused: boolean = false;

  private winCounter: NumberCounter = null!;

  private isLowFPS: boolean = false;

  private static instance: GameManager = null!;
  private static isInitializing: boolean = false;

  // ==========================================
  // Lifecycle Methods
  // ==========================================

  public static getInstance(): GameManager {
    return this.instance;
  }

  protected async onLoad(): Promise<void> {
    if (GameManager.instance && GameManager.instance !== this) {
      logger.warn("GameManager already exists. Destroying duplicate.");
      this.node.destroy();
      return;
    }

    GameManager.instance = this;
    this.node.on(Node.EventType.TOUCH_START, this.resetIdleTime, this);

    try {
      await this.initGame();
      EventManager.on(
        GameConfig.EVENTS.SPIN_COMPLETE,
        this.onSpinComplete,
        this
      );
    } catch (error) {
      logger.error("Failed to initialize game:", error);
      this.handleInitializationError();
    }
  }

  private idleCallback = (): void => {
    if (
      this.currentState === GameConfig.GAME_STATES.IDLE &&
      !this.isAutoPlay &&
      !this.isLowFPS
    ) {
      this.setFPS(GameConfig.GAMEPLAY.IDLE_FPS);
    }
  };

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

  protected onDestroy(): void {
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

  // ==========================================
  // Initialization
  // ==========================================

  private async initGame(): Promise<void> {
    this.walletService = WalletService.getInstance();
    await this.walletService.init(); // Wait for mock API data

    const bundleManager = AssetBundleManager.getInstance();
    const cache = SpriteFrameCache.getInstance();

    const [_symbolsBundle, _audio, _game] = await Promise.all([
      bundleManager.loadBundle(BundleName.SYMBOLS),
      bundleManager.loadBundle(BundleName.AUDIO),
      bundleManager.loadBundle(BundleName.GAME),
    ]);

    const symbolFrames = await bundleManager.loadDir(
      BundleName.SYMBOLS,
      "",
      SpriteFrame
    );

    if (symbolFrames && symbolFrames.length > 0) {
      symbolFrames.forEach((f) => {
        cache.setStaticCache(BundleName.SYMBOLS, f.name, f);
      });
    }

    const slotSct = this.getSlotMachine();
    if (slotSct) await slotSct.initializeSlot();

    this.setupWinCounter();
    this.updateUI();
    this.setupCoinAmountLayout();
    this.setState(GameConfig.GAME_STATES.IDLE);
  }

  private setupWinCounter(): void {
    if (!this.winLabelNode) return;

    this.winCounter = this.winLabelNode.getComponent(NumberCounter);
    if (!this.winCounter) {
      this.winCounter = this.winLabelNode.addComponent(NumberCounter);
    }
    this.winCounter.label = this.winLabel;
    this.winCounter.duration = GameConfig.ANIM.NUMBER_COUNT_DURATION;
    this.winCounter.decimalPlaces = 2;
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
    widget.left = 100;
    widget.updateAlignment();

    this.coinLabel.updateRenderData(true);
  }

  // ==========================================
  // State Management
  // ==========================================

  public setState(state: GameState): void {
    const audioManager = AudioManager.getInstance();

    const wasSpinning = this.currentState === GameConfig.GAME_STATES.SPINNING;
    const isSpinning = state === GameConfig.GAME_STATES.SPINNING;

    if (wasSpinning && !isSpinning) {
      audioManager?.stopSpinSound();
    }

    if (!wasSpinning && isSpinning) {
      const soundPath = GameConfig.SOUNDS.SPIN;
      audioManager?.playSpinSound(soundPath);
    }

    const oldState = this.currentState;
    this.currentState = state;
    this.updateSpinButtonsInteractable();

    // Manage FPS optimization
    if (state === GameConfig.GAME_STATES.IDLE && !this.isAutoPlay) {
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
    const canSpin = this.currentState === GameConfig.GAME_STATES.IDLE;

    if (this.spinButton?.isValid) {
      this.spinButton.setEnabled(canSpin);
    }
  }

  // ==========================================
  // Bet Controls
  // ==========================================

  public increaseBet(): void {
    if (!this.isIdle()) return;
    this.walletService.increaseBet();
    this.updateUI();
  }

  public decreaseBet(): void {
    if (!this.isIdle()) return;
    this.walletService.decreaseBet();
    this.updateUI();
  }

  public setMaxBet(): void {
    if (!this.isIdle()) return;
    this.walletService.setMaxBet();
    this.updateUI();
  }

  // ==========================================
  // Spin Flow
  // ==========================================

  public startSpin(): void {
    const modalManager = ModalManager.getInstance();
    if (modalManager?.isAnyModalActive()) {
      return;
    }

    if (this.isPaused) {
      return;
    }

    if (!this.isIdle()) {
      return;
    }

    const betAmount = this.walletService.currentBet;

    if (!this.walletService.canAfford(betAmount)) {
      this.handleInsufficientCoins();
      return;
    }

    // Deduct coins and check if successful
    const deducted = this.walletService.deductCoins(betAmount);
    if (!deducted) {
      logger.error("Failed to deduct coins for spin");
      ToastManager.getInstance()?.show(
        "Failed to place bet. Please try again."
      );
      return;
    }

    this.lastWin = 0;
    this.updateUI();
    this.setState(GameConfig.GAME_STATES.SPINNING);

    const slot = this.getSlotMachine();
    if (slot) {
      slot.resetAllReels();
      slot.spin();
    }
  }

  public onSpinComplete(): void {
    this.setState(GameConfig.GAME_STATES.STOPPING);

    const slot = this.getSlotMachine();
    if (!slot) {
      this.setState(GameConfig.GAME_STATES.IDLE);
      return;
    }

    const winResult = slot.checkWin();
    this.handleWinResult(slot, winResult.totalWin, winResult.winLines);
  }

  private getSlotMachine(): SlotMachine | null {
    if (!this.slotMachine?.isValid) return null;
    return this.slotMachine.getComponent(SlotMachine);
  }

  // ==========================================
  // Win / Lose Handling
  // ==========================================

  private handleWinResult(
    slot: SlotMachine,
    totalWin: number,
    winLines: any[]
  ): void {
    if (totalWin > 0) {
      slot.showWinEffects(winLines);

      this.onWin(totalWin);
    } else {
      this.onLose();
    }
  }

  private onWin(amount: number): void {
    this.setState(GameConfig.GAME_STATES.WIN_SHOW);
    this.lastWin = amount;
    this.walletService.addCoins(amount);

    if (this.winCounter) {
      this.winCounter.setValue(0);
      this.winCounter.countTo(amount, GameConfig.ANIM.NUMBER_COUNT_DURATION);
    }

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX(GameConfig.SOUNDS.WIN);
    }

    this.updateUI();
    this.handleWinPresentation(amount);

    this.scheduleOnce(() => {
      this.setState(GameConfig.GAME_STATES.IDLE);
      this.continueAutoPlay();
    }, GameConfig.EFFECTS.WIN_SHOW_DURATION);
  }

  private shouldShowWinModal(amount: number): boolean {
    return amount >= GameConfig.GAMEPLAY.BIG_WIN_THRESHOLD;
  }

  private onLose(): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX(GameConfig.SOUNDS.LOSE);
    }
    this.setState(GameConfig.GAME_STATES.IDLE);
    this.continueAutoPlay();
  }

  // ==========================================
  // Coin Fly Effect
  // ==========================================

  private handleWinPresentation(amount: number): void {
    const modalManager = ModalManager.getInstance();

    if (this.shouldShowWinModal(amount) && modalManager) {
      const delay = Math.max(GameConfig.ANIM.WIN_POPUP_DELAY ?? 0, 0);
      this.scheduleOnce(
        () => modalManager.showWinModal(amount, this.walletService.currentBet),
        delay
      );
    } else {
      this.scheduleOnce(() => this.playCoinFlyEffect(), 0.5);
    }
  }

  private playCoinFlyEffect(): void {
    const scene = this.node.scene;
    const canvas =
      scene?.getComponentInChildren("cc.Canvas")?.node ||
      scene?.getChildByName("Canvas");

    if (!canvas || !this.winLabelNode?.isValid || !this.coinIconNode?.isValid) {
      return;
    }

    CoinFlyEffect.play({
      parent: canvas,
      fromNode: this.winLabelNode,
      toNode: this.coinIconNode,
      coinCount: GameConfig.EFFECTS.COIN_FLY_COUNT,
      scatterRadius: GameConfig.EFFECTS.COIN_SCATTER_RADIUS,
      coinSize: GameConfig.EFFECTS.COIN_SIZE,
      onAllArrive: () => {
        if (this.coinIconNode?.isValid) {
          tween(this.coinIconNode)
            .to(0.1, { scale: new Vec3(1.2, 1.2, 1) })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();
        }
      },
    });
  }

  // ==========================================
  // Auto Play
  // ==========================================

  private continueAutoPlay(): void {
    if (this.isAutoPlay && !this.isPaused) {
      this.scheduleOnce(
        this.onAutoPlaySpin,
        GameConfig.GAMEPLAY.AUTO_PLAY_DELAY
      );
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
      this.unschedule(this.onAutoPlaySpin);
    } else if (this.isIdle()) {
      this.startSpin();
    }
  }

  public isAutoPlayActive(): boolean {
    return this.isAutoPlay;
  }

  private updateUI(): void {
    if (this.coinLabel)
      this.coinLabel.string = this.walletService.coins.toFixed(2);
    if (this.betLabel)
      this.betLabel.string = this.walletService.currentBet.toFixed(2);
    if (this.winLabel) this.winLabel.string = this.lastWin.toFixed(2);
  }

  // ==========================================
  // Public API - External Helpers
  // ==========================================

  public addCoins(amount: number): void {
    this.walletService.addCoins(amount);
    this.updateUI();
  }

  public getCurrentBet(): number {
    return this.walletService.currentBet;
  }

  public getPlayerCoins(): number {
    return this.walletService.coins;
  }

  // ==========================================
  // Pause / Resume
  // ==========================================

  public pauseGame(): void {
    this.isPaused = true;
    this.unscheduleAllCallbacks();

    // Save current state before pausing
    this.stateBeforePause = this.currentState;

    const slot = this.getSlotMachine();
    if (slot) {
      slot.stopAllReels();
      slot.setBlurAll(true);
    }

    // Force to idle state when paused
    if (this.currentState === GameConfig.GAME_STATES.SPINNING) {
      this.currentState = GameConfig.GAME_STATES.IDLE;
      this.updateSpinButtonsInteractable();
    }
  }

  public resumeGame(): void {
    this.isPaused = false;

    const slot = this.getSlotMachine();
    if (slot) {
      slot.setBlurAll(false);
    }

    this.stateBeforePause = null;

    if (this.isAutoPlay && this.isIdle()) {
      this.continueAutoPlay();
    }
  }

  public isGamePaused(): boolean {
    return this.isPaused;
  }

  // ==========================================
  // Insufficient Coins Handler
  // ==========================================

  private handleInsufficientCoins(): void {
    const toastManager = ToastManager.getInstance();
    const modalManager = ModalManager.getInstance();

    // Give player some free coins to continue playing
    const freeCoins =
      GameConfig.DEFAULT_COINS * GameConfig.FREE_COINS_MULTIPLIER;

    if (toastManager) {
      toastManager.show(
        `Not enough coins! Added ${freeCoins.toFixed(2)} free coins!`,
        3.0
      );
    }

    this.walletService.addCoins(freeCoins);
    this.updateUI();
  }

  private handleInitializationError(): void {
    const toastManager = ToastManager.getInstance();
    if (toastManager) {
      toastManager.show("Failed to initialize game. Please refresh.", 5.0);
    }

    if (GameManager.instance === this) {
      GameManager.instance = null!;
    }
  }
}
