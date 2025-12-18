import { _decorator, Component, Node, Label } from "cc";
import { GameConfig, GameState } from "../data/GameConfig";
import { SlotMachine } from "./SlotMachine";
import { NumberCounter } from "../utils/NumberCounter";
import { AudioManager } from "../utils/AudioManager";
import { SpinButtonController } from "../ui/SpinButtonController";
import { ModalManager } from "../ui/ModalManager";
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

  private readonly debugLogs: boolean = false;
  private readonly AUTO_PLAY_DELAY: number = 3.5;
  private readonly STORAGE_KEYS = {
    PLAYER_COINS: "playerCoins",
    CURRENT_BET: "currentBet",
  } as const;

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
  }

  protected start(): void {
    this.initGame();
  }

  private initGame(): void {
    const savedCoins = localStorage.getItem(this.STORAGE_KEYS.PLAYER_COINS);
    if (savedCoins) {
      const parsed = parseFloat(savedCoins);
      if (!Number.isNaN(parsed) && parsed > 0) {
        this.playerCoins = parsed;
      }
    }

    const savedBet = localStorage.getItem(this.STORAGE_KEYS.CURRENT_BET);
    if (savedBet) {
      const parsed = parseFloat(savedBet);
      if (!Number.isNaN(parsed) && parsed > 0) {
        const idx = GameConfig.BET_STEPS.indexOf(parsed);
        if (idx >= 0) {
          this.currentBet = parsed;
          this.currentBetIndex = idx;
        }
      }
    }

    this.updateUI();

    if (this.winLabelNode) {
      this.winCounter = this.winLabelNode.getComponent(NumberCounter);
      if (!this.winCounter) {
        this.winCounter = this.winLabelNode.addComponent(NumberCounter);
      }
      this.winCounter.label = this.winLabel;
      this.winCounter.duration = GameConfig.ANIM.NUMBER_COUNT_DURATION;
      this.winCounter.decimalPlaces = 2;
    }

    this.setState(GameConfig.GAME_STATES.IDLE);
  }

  private savePlayerData(): void {
    localStorage.setItem(
      this.STORAGE_KEYS.PLAYER_COINS,
      this.playerCoins.toString()
    );
    localStorage.setItem(
      this.STORAGE_KEYS.CURRENT_BET,
      this.currentBet.toString()
    );
  }

  private updateUI(): void {
    if (this.coinLabel) this.coinLabel.string = this.playerCoins.toFixed(2);
    if (this.betLabel) this.betLabel.string = this.currentBet.toFixed(2);
    if (this.winLabel) this.winLabel.string = this.lastWin.toFixed(2);
  }

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

    let enabled = this.currentState === GameConfig.GAME_STATES.IDLE;
    if (!enabled && this.currentState === GameConfig.GAME_STATES.WIN_SHOW) {
      const modalManager = ModalManager.getInstance();
      enabled = !modalManager || !modalManager.isAnyModalActive();
    }

    if (this.spinButtons?.length) {
      this.spinButtons.forEach((node) => {
        if (!node?.isValid) return;
        node
          .getComponentsInChildren(SpinButtonController)
          .forEach((c) => c?.setEnabled(enabled));
      });
    }
  }

  public getState(): GameState {
    return this.currentState;
  }

  public increaseBet(): void {
    if (this.currentState !== GameConfig.GAME_STATES.IDLE) return;
    if (this.currentBetIndex >= GameConfig.BET_STEPS.length - 1) return;

    this.currentBetIndex++;
    this.currentBet = GameConfig.BET_STEPS[this.currentBetIndex];
    if (this.betLabel) this.betLabel.string = this.currentBet.toFixed(2);
    this.savePlayerData();
  }

  public decreaseBet(): void {
    if (this.currentState !== GameConfig.GAME_STATES.IDLE) return;
    if (this.currentBetIndex <= 0) return;

    this.currentBetIndex--;
    this.currentBet = GameConfig.BET_STEPS[this.currentBetIndex];
    if (this.betLabel) this.betLabel.string = this.currentBet.toFixed(2);
    this.savePlayerData();
  }

  public setMaxBet(): void {
    if (this.currentState !== GameConfig.GAME_STATES.IDLE) return;
    this.currentBetIndex = GameConfig.BET_STEPS.length - 1;
    this.currentBet = GameConfig.BET_STEPS[this.currentBetIndex];
    if (this.betLabel) this.betLabel.string = this.currentBet.toFixed(2);
    this.savePlayerData();
  }

  public startSpin(): void {
    const modalManager = ModalManager.getInstance();
    if (modalManager?.isAnyModalActive()) {
      return;
    }

    if (this.currentState !== GameConfig.GAME_STATES.IDLE) {
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

    const slot = this.slotMachine?.isValid
      ? this.slotMachine.getComponent(SlotMachine)
      : null;
    if (!slot) {
      this.setState(GameConfig.GAME_STATES.IDLE);
      return;
    }

    slot.spin();
  }

  public onSpinComplete(): void {
    this.setState(GameConfig.GAME_STATES.STOPPING);

    const slot = this.slotMachine?.isValid
      ? this.slotMachine.getComponent(SlotMachine)
      : null;
    if (!slot) {
      this.setState(GameConfig.GAME_STATES.IDLE);
      return;
    }

    const winResult = slot.checkWin();
    if (winResult.totalWin > 0 && winResult.winLines.length > 0) {
      slot.showWinLines(winResult.winLines);
    }

    if (winResult.totalWin > 0) {
      this.onWin(winResult.totalWin);
    } else {
      const audioManager = AudioManager.getInstance();
      if (audioManager) {
        const soundPath = `sounds/${GameConfig.SOUNDS.LOSE}`;
        audioManager.playSFX(soundPath);
      }
      this.setState(GameConfig.GAME_STATES.IDLE);
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
      const soundPath = `sounds/${GameConfig.SOUNDS.WIN}`;
      audioManager.playSFX(soundPath);
    }

    this.updateUI();
    this.savePlayerData();

    if (amount > 0) {
      const modalManager = ModalManager.getInstance();
      modalManager?.showWinModal(amount, this.currentBet);
    }

    this.setState(GameConfig.GAME_STATES.IDLE);

    if (this.isAutoPlay) {
      this.scheduleOnce(() => {
        this.startSpin();
      }, this.AUTO_PLAY_DELAY);
    }
  }

  public toggleAutoPlay(): void {
    this.isAutoPlay = !this.isAutoPlay;
    if (this.isAutoPlay && this.currentState === GameConfig.GAME_STATES.IDLE) {
      this.startSpin();
    }
  }

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
