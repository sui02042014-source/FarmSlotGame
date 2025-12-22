import { _decorator, Component, Node } from "cc";
import { GameConfig } from "../data/GameConfig";
import { ReelController } from "./ReelController";
import { GameManager } from "./GameManager";
const { ccclass, property } = _decorator;

@ccclass("SlotMachine")
export class SlotMachine extends Component {
  @property([Node])
  reels: Node[] = [];

  private reelControllers: Array<ReelController | null> = [];
  private isSpinning: boolean = false;
  private currentSymbols: string[][] = [];
  private readonly debugLogs: boolean = false;

  protected start(): void {
    this.reelControllers = new Array(this.reels.length).fill(null);
    this.reels.forEach((reel, col) => {
      const controller = reel.getComponent(ReelController);
      if (!controller) {
        console.warn(`[SlotMachine] ReelController missing at col ${col}`);
        return;
      }
      this.reelControllers[col] = controller;
    });
    if (this.debugLogs) {
      const count = this.reelControllers.filter(Boolean).length;
      console.log(`[SlotMachine] Initialized with ${count} reel controllers`);
    }
  }

  private getReelCount(): number {
    return Math.min(
      GameConfig.REEL_COUNT,
      this.reels.length || GameConfig.REEL_COUNT
    );
  }

  public spin(): void {
    if (!this.reelControllers.length) {
      this.reelControllers = new Array(this.reels.length).fill(null);
      this.reels.forEach((reel, col) => {
        const controller = reel.getComponent(ReelController);
        if (controller) {
          this.reelControllers[col] = controller;
        }
      });
    }

    if (this.isSpinning) {
      if (this.debugLogs) console.log("[SlotMachine] Already spinning");
      return;
    }

    this.isSpinning = true;
    this.unschedule(() => void this.stopSpin());

    const cols = this.getReelCount();
    const targetSymbols: string[][] = [];
    const weights = GameConfig.SYMBOL_WEIGHTS;
    const symbols = Object.keys(weights);
    const totalWeight = Object.values(weights).reduce((a, b) => a + b, 0);

    for (let col = 0; col < cols; col++) {
      const reelSymbols: string[] = [];
      for (let row = 0; row < GameConfig.SYMBOL_PER_REEL; row++) {
        let random = Math.random() * totalWeight;
        for (const symbol of symbols) {
          random -= weights[symbol];
          if (random <= 0) {
            reelSymbols.push(symbol);
            break;
          }
        }
        if (reelSymbols.length === row) reelSymbols.push(symbols[0]);
      }
      targetSymbols.push(reelSymbols);
      this.reelControllers[col]?.spin(reelSymbols, 0);
    }

    this.currentSymbols = targetSymbols;
    this.scheduleOnce(() => void this.stopSpin(), GameConfig.SPIN_DURATION);
    if (this.debugLogs) console.log("[SlotMachine] Spin started");
  }

  private async stopSpin(): Promise<void> {
    if (!this.reelControllers.length) {
      this.reelControllers = new Array(this.reels.length).fill(null);
      this.reels.forEach((reel, col) => {
        const controller = reel.getComponent(ReelController);
        if (controller) {
          this.reelControllers[col] = controller;
        }
      });
    }

    const cols = this.getReelCount();
    const stopPromises: Promise<void>[] = [];

    for (let col = 0; col < cols; col++) {
      const delayTime = col * GameConfig.REEL_STOP_DELAY;
      const stopPromise = new Promise<void>((resolve) => {
        this.scheduleOnce(() => {
          this.reelControllers[col]?.stop().then(() => resolve());
        }, delayTime);
      });
      stopPromises.push(stopPromise);
    }

    await Promise.all(stopPromises);
    this.isSpinning = false;

    const grid: string[][] = [];
    for (let col = 0; col < cols; col++) {
      const colArr: string[] = [];
      const visible = this.reelControllers[col]?.getVisibleSymbols() || [];
      for (let row = 0; row < GameConfig.SYMBOL_PER_REEL; row++) {
        colArr.push(visible[row] ?? "");
      }
      grid.push(colArr);
    }
    this.currentSymbols = grid;

    GameManager.getInstance()?.onSpinComplete();
  }

  public checkWin(): { totalWin: number; winLines: WinLine[] } {
    let totalWin = 0;
    const winLines: WinLine[] = [];
    const cols = this.getReelCount();
    const rows = GameConfig.SYMBOL_PER_REEL;
    const directions = [
      { dc: 1, dr: 0 },
      { dc: 0, dr: 1 },
      { dc: 1, dr: 1 },
      { dc: 1, dr: -1 },
    ];

    for (let col = 0; col < cols; col++) {
      for (let row = 0; row < rows; row++) {
        for (const { dc, dr } of directions) {
          const endCol = col + 2 * dc;
          const endRow = row + 2 * dr;
          if (endCol < 0 || endCol >= cols || endRow < 0 || endRow >= rows)
            continue;

          const s1 = this.currentSymbols[col]?.[row] ?? "";
          const s2 = this.currentSymbols[col + dc]?.[row + dr] ?? "";
          const s3 = this.currentSymbols[endCol]?.[endRow] ?? "";

          if (!s1 || !s2 || !s3 || s1 !== s2 || s2 !== s3) continue;

          const paytable = GameConfig.PAYTABLE[s1];
          const bet = GameManager.getInstance()?.getCurrentBet() || 1;
          const win = paytable?.[3] ? paytable[3] * bet : 0;

          if (win > 0) {
            totalWin += win;
            winLines.push({
              symbol: s1,
              count: 3,
              positions: [
                { col, row },
                { col: col + dc, row: row + dr },
                { col: endCol, row: endRow },
              ],
              win,
            });
          }
        }
      }
    }

    return { totalWin, winLines };
  }

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
      this.reelControllers[col]?.highlightWinSymbols(Array.from(rowsSet));
    });
  }
}

export interface WinLine {
  symbol: string;
  count: number;
  positions: { col: number; row: number }[];
  win: number;
}
