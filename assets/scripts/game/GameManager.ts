import { _decorator, Component, Label, Node } from "cc";
import { GameConfig, GameState } from "../data/GameConfig";
import { ModalManager } from "../ui/ModalManager";
import { SpinButtonController } from "../ui/SpinButtonController";
import { AudioManager } from "../utils/AudioManager";
import { CoinFlyEffect } from "../utils/CoinFlyEffect";
import { NumberCounter } from "../utils/NumberCounter";
import { PlayerDataStorage } from "../utils/PlayerDataStorage";
import { SymbolPreloader } from "../utils/SymbolPreloader";
import { SlotMachine } from "./SlotMachine";

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

  @property([Node])
  spinButtons: Node[] = [];

  private currentState: GameState = GameConfig.GAME_STATES.IDLE;
  private playerCoins: number = 1000;
  private currentBet: number = 3.5;
  private currentBetIndex: number = 3;
  private lastWin: number = 0;
  private isAutoPlay: boolean = false;

  private winCounter: NumberCounter = null!;

  private readonly AUTO_PLAY_DELAY: number = 3.5;
  private readonly BIG_WIN_THRESHOLD: number = 400;

  private static instance: GameManager = null!;

  public static getInstance(): GameManager {
    return this.instance;
  }

  protected onLoad(): void {
    if (GameManager.instance) {
      this.node.destroy();
      return;
    }
    GameManager.instance = this;
  }

  protected onDestroy(): void {
    if (GameManager.instance === this) {
      GameManager.instance = null!;
    }
    CoinFlyEffect.clearPool();
  }

  protected start(): void {
    this.initGame();
  }

  private initGame(): void {
    const loaded = PlayerDataStorage.load(this.playerCoins, this.currentBet);
    this.playerCoins = loaded.coins;
    this.currentBet = loaded.bet;
    this.currentBetIndex = loaded.betIndex;

    SymbolPreloader.preloadAll().catch((err) => {
      console.warn("[GameManager] Failed to preload some sprite frames:", err);
    });
    this.setupWinCounter();
    this.updateUI();
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

  private savePlayerData(): void {
    PlayerDataStorage.save(this.playerCoins, this.currentBet);
  }

  private updateUI(): void {
    if (this.coinLabel) this.coinLabel.string = this.playerCoins.toFixed(2);
    if (this.betLabel) this.betLabel.string = this.currentBet.toFixed(2);
    if (this.winLabel) this.winLabel.string = this.lastWin.toFixed(2);
  }

  // ---------------------------------------------------------------------------
  // State & accessors
  // ---------------------------------------------------------------------------

  public setState(state: GameState): void {
    const audioManager = AudioManager.getInstance();
    const wasSpinning = this.currentState === GameConfig.GAME_STATES.SPINNING;
    const isSpinning = state === GameConfig.GAME_STATES.SPINNING;

    if (wasSpinning && !isSpinning) {
      audioManager?.stopSpinSound();
    }

    if (!wasSpinning && isSpinning) {
      const soundPath = `sounds/${GameConfig.SOUNDS.SPIN}`;
      audioManager?.playSpinSound(soundPath);
    }

    this.currentState = state;
    this.updateSpinButtonsInteractable();
  }

  public getState(): GameState {
    return this.currentState;
  }

  private isIdle(): boolean {
    return this.currentState === GameConfig.GAME_STATES.IDLE;
  }

  private updateSpinButtonsInteractable(): void {
    let enabled = this.isIdle();

    if (!enabled && this.currentState === GameConfig.GAME_STATES.WIN_SHOW) {
      const modalManager = ModalManager.getInstance();
      enabled = !modalManager || !modalManager.isAnyModalActive();
    }

    if (!this.spinButtons?.length) return;

    this.spinButtons.forEach((node) => {
      if (!node?.isValid) return;
      node
        .getComponentsInChildren(SpinButtonController)
        .forEach((c) => c?.setEnabled(enabled));
    });
  }

  // ---------------------------------------------------------------------------
  // Bet controls
  // ---------------------------------------------------------------------------

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

  // ---------------------------------------------------------------------------
  // Spin flow
  // ---------------------------------------------------------------------------

  public startSpin(): void {
    const modalManager = ModalManager.getInstance();
    if (modalManager?.isAnyModalActive()) {
      return;
    }

    if (!this.isIdle()) {
      return;
    }

    if (this.playerCoins < this.currentBet) {
      modalManager?.showNotEnoughCoinsModal(this.currentBet, this.playerCoins);
      return;
    }

    this.playerCoins -= this.currentBet;
    this.lastWin = 0;
    this.updateUI();
    this.setState(GameConfig.GAME_STATES.SPINNING);

    const slot = this.getSlotMachine();
    if (!slot) {
      this.setState(GameConfig.GAME_STATES.IDLE);
      return;
    }

    slot.spin();
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

  // ---------------------------------------------------------------------------
  // Win / Lose handling
  // ---------------------------------------------------------------------------

  private handleWinResult(
    slot: SlotMachine,
    totalWin: number,
    winLines: ReturnType<SlotMachine["checkWin"]>["winLines"]
  ): void {
    if (totalWin > 0 && winLines.length > 0) {
      slot.showWinLines(winLines);
    }

    if (totalWin > 0) {
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
      audioManager.playSFX(`sounds/${GameConfig.SOUNDS.WIN}`);
    }

    this.updateUI();
    this.savePlayerData();

    this.handleWinPresentation(amount);

    this.setState(GameConfig.GAME_STATES.IDLE);
    this.continueAutoPlay();
  }

  private shouldShowWinModal(amount: number): boolean {
    return amount >= this.BIG_WIN_THRESHOLD;
  }

  private handleWinPresentation(amount: number): void {
    const modalManager = ModalManager.getInstance();
    if (this.shouldShowWinModal(amount) && modalManager) {
      modalManager.showWinModal(amount, this.currentBet);
      return;
    }

    this.playCoinFlyEffect();
  }

  private onLose(): void {
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      audioManager.playSFX(`sounds/${GameConfig.SOUNDS.LOSE}`);
    }
    this.setState(GameConfig.GAME_STATES.IDLE);
    this.continueAutoPlay();
  }

  // ---------------------------------------------------------------------------
  // Coin fly effect
  // ---------------------------------------------------------------------------

  private getCoinEffectParent(): Node | null {
    const modalManager = ModalManager.getInstance();
    if (modalManager?.getOverlayContainer?.()) {
      const overlay = modalManager.getOverlayContainer();
      if (overlay?.isValid) return overlay;
    }

    return (
      this.coinIconNode?.parent ??
      this.coinLabel?.node?.parent ??
      this.node.scene?.getChildByName("Canvas") ??
      this.node.parent ??
      this.node
    );
  }

  private getCoinEffectFromNode(): Node | null {
    return this.winLabelNode ?? this.winLabel?.node ?? this.node;
  }

  private getCoinEffectTargetNode(): Node | null {
    if (this.coinIconNode?.isValid) return this.coinIconNode;
    if (this.coinLabel?.node?.isValid) return this.coinLabel.node;
    return null;
  }

  private playCoinFlyEffect(): void {
    const parent = this.getCoinEffectParent();
    const from = this.getCoinEffectFromNode();
    const target = this.getCoinEffectTargetNode();

    if (!parent?.isValid || !from?.isValid || !target?.isValid) {
      return;
    }

    CoinFlyEffect.play({
      parent,
      fromNode: from,
      toNode: target,
      coinCount: 22,
      scatterRadius: 220,
      scatterDuration: 0.22,
      flyDuration: 0.65,
      stagger: 0.02,
      coinSize: 42,
      coinScale: 0.75,
      spriteFramePath: "win/coin_icon/spriteFrame",
    });
  }

  // ---------------------------------------------------------------------------
  // Auto play
  // ---------------------------------------------------------------------------

  private continueAutoPlay(): void {
    if (this.isAutoPlay) {
      this.scheduleOnce(() => this.startSpin(), this.AUTO_PLAY_DELAY);
    }
  }

  public toggleAutoPlay(): void {
    this.isAutoPlay = !this.isAutoPlay;
    if (this.isAutoPlay && this.isIdle()) {
      this.startSpin();
    }
  }

  public isAutoPlayActive(): boolean {
    return this.isAutoPlay;
  }

  // ---------------------------------------------------------------------------
  // External helpers
  // ---------------------------------------------------------------------------

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
}
