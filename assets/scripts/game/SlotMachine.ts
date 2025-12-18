import { _decorator, Component, Node } from "cc";
import { GameConfig } from "../data/GameConfig";
import { ReelController } from "./ReelController";
import { GameManager } from "./GameManager";
const { ccclass, property } = _decorator;

/**
 * Slot Machine - Điều khiển toàn bộ slot machine
 * Đặt script này vào SlotMachineContainer node
 */
@ccclass("SlotMachine")
export class SlotMachine extends Component {
  @property([Node])
  reels: Node[] = []; // 5 reel nodes

  // Keep controller index aligned with reel column index.
  private reelControllers: Array<ReelController | null> = [];
  private isSpinning: boolean = false;
  private currentSymbols: string[][] = []; // [col][row]
  private readonly debugLogs: boolean = false;
  private readonly stopSpinCallback = () => {
    void this.stopSpin();
  };

  protected start(): void {
    this.initSlotMachine();
  }

  /**
   * Khởi tạo slot machine
   */
  private initSlotMachine(): void {
    // Build a column-indexed array so win/highlight uses correct columns.
    this.reelControllers = new Array(this.reels.length).fill(null);

    this.reels.forEach((reel, col) => {
      const controller = reel.getComponent(ReelController);
      if (!controller) {
        console.warn(`[SlotMachine] ReelController missing at col ${col}`);
        return;
      }
      controller.reelIndex = col;
      this.reelControllers[col] = controller;
    });

    if (this.debugLogs) {
      const count = this.reelControllers.filter(Boolean).length;
      console.log(`[SlotMachine] Initialized with ${count} reel controllers`);
    }
  }

  private ensureInitialized(): void {
    if (!this.reelControllers.length) this.initSlotMachine();
  }

  private getReelCount(): number {
    return Math.min(
      GameConfig.REEL_COUNT,
      this.reels.length || GameConfig.REEL_COUNT
    );
  }

  private buildEmptyGrid(): string[][] {
    const cols = this.getReelCount();
    const rows = GameConfig.SYMBOL_PER_REEL;
    const grid: string[][] = [];
    for (let col = 0; col < cols; col++) {
      const colArr: string[] = [];
      for (let row = 0; row < rows; row++) colArr.push("");
      grid.push(colArr);
    }
    return grid;
  }

  /**
   * Bắt đầu spin
   */
  public spin(): void {
    this.ensureInitialized();
    if (this.isSpinning) {
      if (this.debugLogs) console.log("[SlotMachine] Already spinning");
      return;
    }

    this.isSpinning = true;
    this.unschedule(this.stopSpinCallback);

    // Generate target symbols cho mỗi reel
    const targetSymbols = this.generateSpinResult();

    // Start spinning each reel (aligned by column)
    const cols = this.getReelCount();
    for (let col = 0; col < cols; col++) {
      const controller = this.reelControllers[col];
      if (!controller) continue;
      controller.spin(targetSymbols[col], 0);
    }

    // Schedule stop
    this.scheduleOnce(this.stopSpinCallback, GameConfig.SPIN_DURATION);

    if (this.debugLogs) console.log("[SlotMachine] Spin started");
  }

  /**
   * Generate spin result (random symbols)
   */
  private generateSpinResult(): string[][] {
    const result: string[][] = [];

    const cols = this.getReelCount();
    for (let col = 0; col < cols; col++) {
      const reelSymbols: string[] = [];
      for (let row = 0; row < GameConfig.SYMBOL_PER_REEL; row++) {
        reelSymbols.push(this.getRandomSymbol());
      }
      result.push(reelSymbols);
    }

    this.currentSymbols = result;
    return result;
  }

  /**
   * Get random symbol với weight
   */
  private getRandomSymbol(): string {
    const weights = GameConfig.SYMBOL_WEIGHTS;
    const symbols = Object.keys(weights);
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    let random = Math.random() * totalWeight;

    for (const symbol of symbols) {
      random -= weights[symbol];
      if (random <= 0) {
        return symbol;
      }
    }

    return symbols[0];
  }

  /**
   * Dừng spin (từng reel một)
   */
  private async stopSpin(): Promise<void> {
    this.ensureInitialized();
    // Bắt đầu dừng các reels với delay nhỏ, không đợi reel trước dừng hoàn toàn
    const stopPromises: Promise<void>[] = [];

    const cols = this.getReelCount();
    for (let col = 0; col < cols; col++) {
      // Delay trước khi bắt đầu dừng reel này
      const delayTime = col * GameConfig.REEL_STOP_DELAY;

      const stopPromise = this.delay(delayTime).then(() => {
        const controller = this.reelControllers[col];
        if (!controller) return Promise.resolve();
        return controller.stop();
      });

      stopPromises.push(stopPromise);
    }

    // Đợi tất cả reels dừng xong
    await Promise.all(stopPromises);

    // Spin complete
    this.onSpinComplete();
  }

  /**
   * Delay helper
   */
  private delay(seconds: number): Promise<void> {
    return new Promise((resolve) => {
      this.scheduleOnce(() => resolve(), seconds);
    });
  }

  /**
   * On spin complete
   */
  private onSpinComplete(): void {
    this.isSpinning = false;

    // Get final symbols
    this.currentSymbols = this.getCurrentSymbols();

    // Notify GameManager
    const gameManager = GameManager.getInstance();
    if (gameManager) {
      gameManager.onSpinComplete();
    }
  }

  /**
   * Get current symbols from reels
   */
  private getCurrentSymbols(): string[][] {
    const grid = this.buildEmptyGrid();
    const cols = this.getReelCount();
    for (let col = 0; col < cols; col++) {
      const controller = this.reelControllers[col];
      if (!controller) continue;
      const visible = controller.getVisibleSymbols();
      for (let row = 0; row < GameConfig.SYMBOL_PER_REEL; row++) {
        grid[col][row] = visible[row] ?? "";
      }
    }
    return grid;
  }

  /**
   * Check win combinations
   * Check 3 symbols giống nhau liên tiếp đang visible theo: ngang, dọc, chéo
   */
  public checkWin(): { totalWin: number; winLines: WinLine[] } {
    let totalWin = 0;
    const winLines: WinLine[] = [];

    const cols = this.getReelCount();
    const rows = GameConfig.SYMBOL_PER_REEL;
    const needed = 3;

    const inBounds = (col: number, row: number) =>
      col >= 0 && col < cols && row >= 0 && row < rows;

    const getSymbolAt = (col: number, row: number) =>
      this.currentSymbols[col]?.[row] ?? "";

    const tryAddWinLine = (positions: { col: number; row: number }[]) => {
      if (positions.length !== needed) return;
      const s1 = getSymbolAt(positions[0].col, positions[0].row);
      const s2 = getSymbolAt(positions[1].col, positions[1].row);
      const s3 = getSymbolAt(positions[2].col, positions[2].row);
      if (!s1 || !s2 || !s3) return;
      if (s1 !== s2 || s2 !== s3) return;

      const win = this.calculateWin(s1, needed);
      if (win <= 0) return;

      totalWin += win;
      winLines.push({ symbol: s1, count: needed, positions, win });
    };

    // Directions: right, down, diag-down-right, diag-up-right
    const directions: Array<{ dc: number; dr: number }> = [
      { dc: 1, dr: 0 },
      { dc: 0, dr: 1 },
      { dc: 1, dr: 1 },
      { dc: 1, dr: -1 },
    ];

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        for (const { dc, dr } of directions) {
          const endCol = col + (needed - 1) * dc;
          const endRow = row + (needed - 1) * dr;
          if (!inBounds(endCol, endRow)) continue;

          const positions = [
            { col, row },
            { col: col + dc, row: row + dr },
            { col: col + 2 * dc, row: row + 2 * dr },
          ];
          tryAddWinLine(positions);
        }
      }
    }

    return { totalWin, winLines };
  }

  /**
   * Hiển thị highlight các symbols thắng trên các reels
   * (GameManager đang gọi hàm này sau khi checkWin)
   */
  public showWinLines(winLines: WinLine[]): void {
    if (!winLines?.length) return;

    const rowsByCol = new Map<number, Set<number>>();
    winLines.forEach((line) => {
      line.positions.forEach((p) => {
        if (!rowsByCol.has(p.col)) rowsByCol.set(p.col, new Set<number>());
        rowsByCol.get(p.col)!.add(p.row);
      });
    });

    rowsByCol.forEach((rowsSet, col) => {
      const controller = this.reelControllers[col];
      if (!controller) return;
      controller.highlightWinSymbols(Array.from(rowsSet));
    });
  }

  /**
   * Tính win amount cho symbol và số lượng
   */
  private calculateWin(symbol: string, count: number): number {
    const paytable = GameConfig.PAYTABLE[symbol];
    if (!paytable || !paytable[count]) {
      return 0;
    }

    const gameManager = GameManager.getInstance();
    const bet = gameManager ? gameManager.getCurrentBet() : 1;
    return paytable[count] * bet;
  }

  /**
   * Force stop (emergency stop)
   */
  public forceStop(): void {
    this.unschedule(this.stopSpinCallback);
    this.reelControllers.forEach((controller) => {
      controller?.reset();
    });
    this.isSpinning = false;
  }
}

/**
 * Win Line interface - Simplified
 */
export interface WinLine {
  symbol: string; // Winning symbol
  count: number; // Number of matching symbols
  positions: { col: number; row: number }[]; // Vị trí các symbols thắng
  win: number; // Win amount
}
