import { _decorator, Component, Node, Label } from "cc";
import { GameConfig, GameState } from "../data/GameConfig";
import { SlotMachine } from "./SlotMachine";
import { NumberCounter } from "../utils/NumberCounter";
import { AudioManager } from "../utils/AudioManager";
import { SpinButtonController } from "../ui/SpinButtonController";
import { ModalManager } from "../ui/ModalManager";
const { ccclass, property } = _decorator;

/**
 * Game Manager - Quản lý toàn bộ game
 * Đặt script này vào Canvas node
 */
@ccclass("GameManager")
export class GameManager extends Component {
  @property(Node)
  slotMachine: Node = null!;

  @property(Node)
  topBar: Node = null!;

  @property(Node)
  bottomBar: Node = null!;

  @property(Label)
  coinLabel: Label = null!;

  @property(Label)
  betLabel: Label = null!;

  @property(Label)
  winLabel: Label = null!;

  @property(Node)
  winLabelNode: Node = null!;

  @property([Node])
  uiButtonsToDisable: Node[] = []; // (Deprecated) Previously used to disable all buttons; kept for compatibility.

  @property([Node])
  spinButtons: Node[] = []; // Drag ONLY spin button node(s) here (node holding SpinButtonController or its parent)

  // Game State
  private currentState: GameState = GameConfig.GAME_STATES.IDLE;
  private playerCoins: number = 1000;
  private currentBet: number = 3.5;
  private currentBetIndex: number = 3;
  private lastWin: number = 0;
  private isAutoPlay: boolean = false;

  private winCounter: NumberCounter = null!;
  private readonly debugLogs: boolean = false;

  // Singleton
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

  /**
   * Khởi tạo game
   */
  private initGame(): void {
    // Load player data (từ LocalStorage hoặc Server)
    this.loadPlayerData();

    // Update UI
    this.updateUI();

    // Init helpers
    this.initHelpers();

    // Set initial state
    this.setState(GameConfig.GAME_STATES.IDLE);

    if (this.debugLogs) console.log("[GameManager] Game initialized");
  }

  /**
   * Khởi tạo các helper components (NumberCounter, AudioManager, ...)
   */
  private initHelpers(): void {
    if (this.winLabelNode) {
      this.winCounter = this.winLabelNode.getComponent(NumberCounter);
      if (!this.winCounter) {
        this.winCounter = this.winLabelNode.addComponent(NumberCounter);
      }
      this.winCounter.label = this.winLabel;
      this.winCounter.duration = GameConfig.ANIM.NUMBER_COUNT_DURATION;
      this.winCounter.decimalPlaces = 2;
    }
  }

  /**
   * Load dữ liệu người chơi
   */
  private loadPlayerData(): void {
    // TODO: Load từ LocalStorage hoặc Server
    const savedCoins = localStorage.getItem("playerCoins");
    if (savedCoins) {
      const parsed = parseFloat(savedCoins);
      if (!Number.isNaN(parsed)) this.playerCoins = parsed;
    }

    const savedBet = localStorage.getItem("currentBet");
    if (savedBet) {
      const parsed = parseFloat(savedBet);
      if (!Number.isNaN(parsed)) {
        this.currentBet = parsed;
        const idx = GameConfig.BET_STEPS.indexOf(this.currentBet);
        this.currentBetIndex = idx >= 0 ? idx : 0;
      }
    }
  }

  /**
   * Save dữ liệu người chơi
   */
  private savePlayerData(): void {
    localStorage.setItem("playerCoins", this.playerCoins.toString());
    localStorage.setItem("currentBet", this.currentBet.toString());
  }

  /**
   * Update tất cả UI
   */
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

  /**
   * Set game state
   */
  public setState(state: GameState): void {
    if (this.debugLogs) {
      console.log(
        `[GameManager] State changed: ${this.currentState} -> ${state}`
      );
    }
    this.currentState = state;
    this.syncSpinButtonsForState();
  }

  /**
   * Get current state
   */
  public getState(): GameState {
    return this.currentState;
  }

  private syncSpinButtonsForState(): void {
    const enabled = this.currentState === GameConfig.GAME_STATES.IDLE;
    this.setSpinButtonsEnabled(enabled);
  }

  private setSpinButtonsEnabled(enabled: boolean): void {
    const roots = this.spinButtons?.length
      ? this.spinButtons
      : this.uiButtonsToDisable;
    if (!roots?.length) return;

    roots.forEach((node) => {
      if (!node?.isValid) return;
      // Enable/disable ONLY SpinButtonController(s)
      const spinBtns = node.getComponentsInChildren(SpinButtonController);
      spinBtns.forEach((c) => c?.setEnabled(enabled));
    });
  }

  /**
   * Tăng bet
   */
  public increaseBet(): void {
    if (this.debugLogs) console.log(`[GameManager] Increase bet`);
    if (this.currentState !== GameConfig.GAME_STATES.IDLE) return;

    if (this.currentBetIndex < GameConfig.BET_STEPS.length - 1) {
      this.currentBetIndex++;
      this.currentBet = GameConfig.BET_STEPS[this.currentBetIndex];
      this.updateUI();
      this.savePlayerData();
      if (this.debugLogs) {
        console.log(`[GameManager] Bet increased to: ${this.currentBet}`);
      }
    }
  }

  /**
   * Giảm bet
   */
  public decreaseBet(): void {
    if (this.debugLogs) console.log(`[GameManager] Decrease bet`);
    if (this.currentState !== GameConfig.GAME_STATES.IDLE) return;

    if (this.currentBetIndex > 0) {
      this.currentBetIndex--;
      this.currentBet = GameConfig.BET_STEPS[this.currentBetIndex];
      this.updateUI();
      this.savePlayerData();
      if (this.debugLogs) {
        console.log(`[GameManager] Bet decreased to: ${this.currentBet}`);
      }
    }
  }

  /**
   * Set max bet
   */
  public setMaxBet(): void {
    if (this.currentState !== GameConfig.GAME_STATES.IDLE) return;

    this.currentBetIndex = GameConfig.BET_STEPS.length - 1;
    this.currentBet = GameConfig.BET_STEPS[this.currentBetIndex];
    this.updateUI();
    this.savePlayerData();
    if (this.debugLogs)
      console.log(`[GameManager] Max bet set: ${this.currentBet}`);
  }

  private getSlotMachine(): SlotMachine | null {
    if (!this.slotMachine?.isValid) return null;
    return this.slotMachine.getComponent(SlotMachine);
  }

  /**
   * Start spin
   */
  public startSpin(): void {
    if (this.currentState !== GameConfig.GAME_STATES.IDLE) {
      if (this.debugLogs) {
        console.log("[GameManager] Cannot spin - not in IDLE state");
      }
      return;
    }

    // Check đủ tiền không
    if (this.playerCoins < this.currentBet) {
      console.log("[GameManager] Not enough coins!");
      // Show not enough coins modal
      const modalManager = ModalManager.getInstance();
      if (modalManager) {
        modalManager.showNotEnoughCoinsModal(this.currentBet, this.playerCoins);
      }
      return;
    }

    // Trừ tiền
    this.playerCoins -= this.currentBet;
    this.lastWin = 0;
    this.updateUI();

    // Change state
    this.setState(GameConfig.GAME_STATES.SPINNING);

    // Gọi SlotMachine để spin
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

  /**
   * On spin complete (được gọi từ SlotMachine)
   */
  public onSpinComplete(symbols: string[][]): void {
    this.setState(GameConfig.GAME_STATES.STOPPING);

    // Check win
    const winResult = this.checkWin(symbols);

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
      console.log(
        `[GameManager] ❌ No Win - Need 3 matching symbols horizontally or vertically!`
      );
      // No win
      this.setState(GameConfig.GAME_STATES.IDLE);
    }
  }

  /**
   * Check win combinations
   */
  private checkWin(symbols: string[][]): { totalWin: number; winLines: any[] } {
    const slotMachineComp = this.getSlotMachine();
    if (!slotMachineComp) {
      console.warn("[GameManager] SlotMachine component not found");
      return { totalWin: 0, winLines: [] };
    }

    // Sử dụng logic tính thưởng đã được hiện thực trong SlotMachine
    const result = slotMachineComp.checkWin();

    // Hiển thị các dòng thắng trên slot machine
    if (result.totalWin > 0 && result.winLines.length > 0) {
      slotMachineComp.showWinLines(result.winLines);
    }

    return {
      totalWin: result.totalWin,
      winLines: result.winLines,
    };
  }

  /**
   * On win
   */
  private onWin(amount: number): void {
    this.setState(GameConfig.GAME_STATES.WIN_SHOW);
    this.lastWin = amount;
    this.playerCoins += amount;

    // Animate win
    this.animateWin(amount);

    // Update UI
    this.updateUI();
    this.savePlayerData();

    console.log(
      `[GameManager] WIN! Amount: ${amount}, Total coins: ${this.playerCoins}`
    );

    // Show win modal khi thắng (bất kể số tiền)
    if (amount > 0) {
      const modalManager = ModalManager.getInstance();
      if (modalManager) {
        modalManager.showWinModal(amount, this.currentBet);
      }
    }

    // Return to idle after animation
    this.scheduleOnce(() => {
      this.setState(GameConfig.GAME_STATES.IDLE);

      // Auto play next spin
      if (this.isAutoPlay) {
        this.startSpin();
      }
    }, GameConfig.ANIM.WIN_POPUP_DELAY + 2.0);
  }

  /**
   * Animate win amount counting up
   */
  private animateWin(amount: number): void {
    // Hiệu ứng đếm số từ 0 lên amount trên winLabel
    if (this.winCounter) {
      this.winCounter.setValue(0);
      this.winCounter.countTo(amount, GameConfig.ANIM.NUMBER_COUNT_DURATION);
    }

    // Play sound theo mức win
    const audioManager = AudioManager.getInstance();
    if (audioManager) {
      let soundKey = GameConfig.SOUNDS.WIN_SMALL;
      if (amount >= this.currentBet * 20) {
        soundKey = GameConfig.SOUNDS.WIN_MEGA;
      } else if (amount >= this.currentBet * 5) {
        soundKey = GameConfig.SOUNDS.WIN_BIG;
      }

      audioManager.playSFX(`sounds/${soundKey}`);
    }
  }

  /**
   * Toggle auto play
   */
  public toggleAutoPlay(): void {
    this.isAutoPlay = !this.isAutoPlay;
    console.log(`[GameManager] Auto play: ${this.isAutoPlay ? "ON" : "OFF"}`);

    if (this.isAutoPlay && this.currentState === GameConfig.GAME_STATES.IDLE) {
      this.startSpin();
    }
  }

  /**
   * Add coins (từ purchase hoặc reward)
   */
  public addCoins(amount: number): void {
    this.playerCoins += amount;
    this.updateUI();
    this.savePlayerData();
    console.log(
      `[GameManager] Coins added: ${amount}, Total: ${this.playerCoins}`
    );
  }

  /**
   * Get current bet
   */
  public getCurrentBet(): number {
    return this.currentBet;
  }

  /**
   * Get player coins
   */
  public getPlayerCoins(): number {
    return this.playerCoins;
  }
}
