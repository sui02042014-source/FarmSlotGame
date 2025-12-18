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
    if (this.debugLogs) console.log("[GameManager] Initialized");
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

    if (this.debugLogs) console.log("[GameManager] Game initialized");
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
    if (this.coinLabel) {
      this.coinLabel.string = this.playerCoins.toFixed(2);
    }
    if (this.betLabel) {
      this.betLabel.string = this.currentBet.toFixed(2);
    }
    if (this.winLabel) {
      this.winLabel.string = this.lastWin.toFixed(2);
    }
  }

  private updateCoinLabel(): void {
    if (this.coinLabel) {
      this.coinLabel.string = this.playerCoins.toFixed(2);
    }
  }

  private updateBetLabel(): void {
    if (this.betLabel) {
      this.betLabel.string = this.currentBet.toFixed(2);
    }
  }

  public setState(state: GameState): void {
    if (this.debugLogs) {
      console.log(
        `[GameManager] State changed: ${this.currentState} -> ${state}`
      );
    }
    this.currentState = state;

    let enabled = this.isIdleState();
    if (!enabled && this.currentState === GameConfig.GAME_STATES.WIN_SHOW) {
      const modalManager = ModalManager.getInstance();
      enabled = !modalManager || !modalManager.isAnyModalActive();
    }

    if (this.spinButtons?.length) {
      this.spinButtons.forEach((node) => {
        if (!node?.isValid) return;
        const spinBtns = node.getComponentsInChildren(SpinButtonController);
        spinBtns.forEach((c) => c?.setEnabled(enabled));
      });
    }
  }

  public getState(): GameState {
    return this.currentState;
  }

  private isIdleState(): boolean {
    return this.currentState === GameConfig.GAME_STATES.IDLE;
  }

  public increaseBet(): void {
    if (this.debugLogs) console.log(`[GameManager] Increase bet`);
    if (!this.isIdleState()) return;

    if (this.currentBetIndex < GameConfig.BET_STEPS.length - 1) {
      this.setBetByIndex(this.currentBetIndex + 1);
      if (this.debugLogs) {
        console.log(`[GameManager] Bet increased to: ${this.currentBet}`);
      }
    }
  }

  public decreaseBet(): void {
    if (this.debugLogs) console.log(`[GameManager] Decrease bet`);
    if (!this.isIdleState()) return;

    if (this.currentBetIndex > 0) {
      this.setBetByIndex(this.currentBetIndex - 1);
      if (this.debugLogs) {
        console.log(`[GameManager] Bet decreased to: ${this.currentBet}`);
      }
    }
  }

  public setMaxBet(): void {
    if (!this.isIdleState()) return;
    this.setBetByIndex(GameConfig.BET_STEPS.length - 1);
    if (this.debugLogs)
      console.log(`[GameManager] Max bet set: ${this.currentBet}`);
  }

  private setBetByIndex(index: number): void {
    if (index < 0 || index >= GameConfig.BET_STEPS.length) return;
    this.currentBetIndex = index;
    this.currentBet = GameConfig.BET_STEPS[index];
    this.updateBetLabel();
    this.savePlayerData();
  }

  public startSpin(): void {
    const modalManager = ModalManager.getInstance();
    if (modalManager?.isAnyModalActive()) {
      if (this.debugLogs) {
        console.log("[GameManager] Cannot spin - modal is active");
      }
      return;
    }

    if (!this.isIdleState()) {
      if (this.debugLogs) {
        console.log("[GameManager] Cannot spin - not in IDLE state");
      }
      return;
    }

    if (this.playerCoins < this.currentBet) {
      console.log("[GameManager] Not enough coins!");
      const modalManager = ModalManager.getInstance();
      modalManager?.showNotEnoughCoinsModal(this.currentBet, this.playerCoins);
      return;
    }

    this.playerCoins -= this.currentBet;
    this.lastWin = 0;
    this.updateUI();
    this.setState(GameConfig.GAME_STATES.SPINNING);

    const slot = this.getSlotMachine();
    if (!slot) {
      console.warn("[GameManager] SlotMachine component not found");
      this.setState(GameConfig.GAME_STATES.IDLE);
      return;
    }

    slot.spin();

    if (this.debugLogs) {
      console.log(
        `[GameManager] Spin started - Bet: ${this.currentBet}, Remaining coins: ${this.playerCoins}`
      );
    }
  }

  private getSlotMachine(): SlotMachine | null {
    if (!this.slotMachine?.isValid) return null;
    return this.slotMachine.getComponent(SlotMachine);
  }

  public onSpinComplete(): void {
    this.setState(GameConfig.GAME_STATES.STOPPING);

    const slotMachineComp = this.getSlotMachine();
    if (!slotMachineComp) {
      console.warn("[GameManager] SlotMachine component not found");
      this.setState(GameConfig.GAME_STATES.IDLE);
      return;
    }

    const winResult = slotMachineComp.checkWin();

    if (winResult.totalWin > 0 && winResult.winLines.length > 0) {
      slotMachineComp.showWinLines(winResult.winLines);
    }

    if (this.debugLogs) {
      console.log(
        `[GameManager] Spin result - Total Win: ${winResult.totalWin.toFixed(
          2
        )}, Win Combinations: ${winResult.winLines.length}`
      );
    }

    if (winResult.totalWin > 0) {
      console.log(
        `[GameManager] 🎉 YOU WIN! Amount: ${winResult.totalWin.toFixed(
          2
        )} (Bet: ${this.currentBet})`
      );

      winResult.winLines.forEach((line) => {
        const posStr = ` at [${line.positions
          .map((p) => `${p.col}:${p.row}`)
          .join(", ")}]`;
        console.log(
          `  ✓ ${
            line.count
          }x ${line.symbol.toUpperCase()}${posStr} = ${line.win.toFixed(
            2
          )} coins`
        );
      });

      this.onWin(winResult.totalWin);
    } else {
      console.log(`[GameManager] ❌ No Win!`);
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
      let soundKey = GameConfig.SOUNDS.WIN_SMALL;
      const multiplier = amount / this.currentBet;

      if (multiplier >= 20) {
        soundKey = GameConfig.SOUNDS.WIN_MEGA;
      } else if (multiplier >= 5) {
        soundKey = GameConfig.SOUNDS.WIN_BIG;
      }

      audioManager.playSFX(`sounds/${soundKey}`);
    }

    this.updateUI();
    this.savePlayerData();

    console.log(
      `[GameManager] WIN! Amount: ${amount}, Total coins: ${this.playerCoins}`
    );

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
    console.log(`[GameManager] Auto play: ${this.isAutoPlay ? "ON" : "OFF"}`);

    if (this.isAutoPlay && this.isIdleState()) {
      this.startSpin();
    }
  }

  public addCoins(amount: number): void {
    if (amount <= 0) return;
    this.playerCoins += amount;
    this.updateCoinLabel();
    this.savePlayerData();
  }

  public getCurrentBet(): number {
    return this.currentBet;
  }

  public getPlayerCoins(): number {
    return this.playerCoins;
  }
}
