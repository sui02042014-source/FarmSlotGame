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
import { AudioManager } from "../audio/audio-manager";
import { GameConfig, GameState } from "../../data/config/game-config";
import { CoinFlyEffect } from "../../utils/effects/coin-fly-effect";
import { CoinRainEffect } from "../../utils/effects/coin-rain-effect";
import { NumberCounter } from "../../utils/helpers/number-counter";
import { SpriteFrameCache } from "../../utils/helpers/sprite-frame-cache";
import { PlayerDataStorage } from "../../utils/storage/player-data-storage";
import { AssetBundleManager, BundleName } from "../assets/asset-bundle-manager";
import { SlotMachine } from "../slot-machine/slot-machine";
import { ToastManager } from "../../components/toast/toast-manager";

const { ccclass, property } = _decorator;

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

  private currentState: GameState = GameConfig.GAME_STATES.IDLE;
  private playerCoins: number = 1000;
  private currentBet: number = 3.5;
  private currentBetIndex: number = 3;
  private lastWin: number = 0;
  private isAutoPlay: boolean = false;
  private isPaused: boolean = false;

  private winCounter: NumberCounter = null!;

  private readonly AUTO_PLAY_DELAY: number = 3.5;
  private readonly BIG_WIN_THRESHOLD: number = 1000;
  private readonly IDLE_THRESHOLD: number = 10;
  private readonly IDLE_FPS: number = 30;
  private readonly ACTIVE_FPS: number = 60;

  private idleTime: number = 0;
  private isLowFPS: boolean = false;

  private static instance: GameManager = null!;

  // ==========================================
  // Lifecycle Methods
  // ==========================================

  public static getInstance(): GameManager {
    return this.instance;
  }

  protected async onLoad(): Promise<void> {
    if (GameManager.instance) {
      this.node.destroy();
      return;
    }
    GameManager.instance = this;

    this.node.on(Node.EventType.TOUCH_START, this.resetIdleTime, this);

    await this.initGame();
  }

  protected update(dt: number): void {
    if (this.currentState === GameConfig.GAME_STATES.IDLE && !this.isAutoPlay) {
      this.idleTime += dt;
      if (this.idleTime >= this.IDLE_THRESHOLD && !this.isLowFPS) {
        this.setFPS(this.IDLE_FPS);
      }
    } else {
      this.resetIdleTime();
    }
  }

  private resetIdleTime(): void {
    this.idleTime = 0;
    if (this.isLowFPS) {
      this.setFPS(this.ACTIVE_FPS);
    }
  }

  private setFPS(fps: number): void {
    game.frameRate = fps;
    this.isLowFPS = fps <= this.IDLE_FPS;
    console.log(`[GameManager] Frame rate set to: ${fps}`);
  }

  protected onDestroy(): void {
    if (GameManager.instance === this) {
      GameManager.instance = null!;
    }
    CoinFlyEffect.clearPool();
    CoinRainEffect.clear();
  }

  // ==========================================
  // Initialization
  // ==========================================
  private async initGame(): Promise<void> {
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
    if (slotSct) slotSct.initializeSlot();

    const loaded = PlayerDataStorage.load(this.playerCoins, this.currentBet);
    this.playerCoins = loaded.coins;
    this.currentBet = loaded.bet;

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

    this.currentState = state;
    this.updateSpinButtonsInteractable();
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
    if (this.currentBetIndex >= GameConfig.BET_STEPS.length - 1) return;

    this.setBetByIndex(this.currentBetIndex + 1);
  }

  public decreaseBet(): void {
    if (!this.isIdle()) return;
    if (this.currentBetIndex <= 0) return;

    this.setBetByIndex(this.currentBetIndex - 1);
  }

  public setMaxBet(): void {
    if (!this.isIdle()) return;
    this.setBetByIndex(GameConfig.BET_STEPS.length - 1);
  }

  private setBetByIndex(index: number): void {
    this.currentBetIndex = index;
    this.currentBet = GameConfig.BET_STEPS[this.currentBetIndex];
    if (this.betLabel) {
      this.betLabel.string = this.currentBet.toFixed(2);
    }
    this.savePlayerData();
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

    if (this.playerCoins < this.currentBet) {
      ToastManager.getInstance()?.show("Not enough coins!");
      return;
    }

    this.playerCoins -= this.currentBet;
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
    this.playerCoins += amount;

    if (this.winCounter) {
      this.winCounter.setValue(0);
      this.winCounter.countTo(amount, GameConfig.ANIM.NUMBER_COUNT_DURATION);
    }

    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX(GameConfig.SOUNDS.WIN);
    }

    this.updateUI();
    this.savePlayerData();
    this.handleWinPresentation(amount);

    this.scheduleOnce(() => {
      this.setState(GameConfig.GAME_STATES.IDLE);
      this.continueAutoPlay();
    }, 2.0);
  }

  private shouldShowWinModal(amount: number): boolean {
    return amount >= this.BIG_WIN_THRESHOLD;
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
        () => modalManager.showWinModal(amount, this.currentBet),
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
      coinCount: 20,
      scatterRadius: 150,
      coinSize: 60,
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
      this.scheduleOnce(this.onAutoPlaySpin, this.AUTO_PLAY_DELAY);
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

  // ==========================================
  // Data Management
  // ==========================================

  private savePlayerData(): void {
    PlayerDataStorage.save(this.playerCoins, this.currentBet);
  }

  private updateUI(): void {
    if (this.coinLabel) this.coinLabel.string = this.playerCoins.toFixed(2);
    if (this.betLabel) this.betLabel.string = this.currentBet.toFixed(2);
    if (this.winLabel) this.winLabel.string = this.lastWin.toFixed(2);
  }

  // ==========================================
  // Public API - External Helpers
  // ==========================================

  public addCoins(amount: number): void {
    if (amount <= 0) return;
    this.playerCoins += amount;
    if (this.coinLabel) this.coinLabel.string = this.playerCoins.toFixed(2);
    this.savePlayerData();
  }

  public getCurrentBet(): number {
    return this.currentBet;
  }

  public getPlayerCoins(): number {
    return this.playerCoins;
  }

  // ==========================================
  // Pause / Resume
  // ==========================================

  public pauseGame(): void {
    this.isPaused = true;
    this.unscheduleAllCallbacks();

    const slot = this.getSlotMachine();
    if (slot) {
      slot.stopAllReels();
      slot.setBlurAll(true);
    }

    if (this.currentState === GameConfig.GAME_STATES.SPINNING) {
      this.setState(GameConfig.GAME_STATES.IDLE);
    }
  }

  public resumeGame(): void {
    this.isPaused = false;

    const slot = this.getSlotMachine();
    if (slot) {
      slot.setBlurAll(false);
    }

    if (this.isAutoPlay && this.isIdle()) {
      this.continueAutoPlay();
    }
  }

  public isGamePaused(): boolean {
    return this.isPaused;
  }
}
