import { _decorator } from "cc";
const { ccclass } = _decorator;

@ccclass("GameConfig")
export class GameConfig {
  static readonly REEL_COUNT = 5;
  static readonly SYMBOL_PER_REEL = 3;
  static readonly SYMBOL_SIZE = 200;
  static readonly SYMBOL_SPACING = 50;

  static readonly SPIN_DURATION = 2.0;
  static readonly REEL_STOP_DELAY = 0.03;
  static readonly SPIN_SPEED_MIN = 1700;
  static readonly SPIN_SPEED_MAX = 3000;
  static readonly BOUNCE_DURATION = 0.2;

  static readonly MIN_BET = 0.5;
  static readonly MAX_BET = 100.0;
  static readonly BET_STEPS = [
    0.5, 1.0, 2.0, 3.5, 5.0, 10.0, 25.0, 50.0, 100.0,
  ];

  static readonly SYMBOL_TYPES = {
    PIG: "pig",
    COW: "cow",
    CHICKEN: "chicken",
    RABBIT: "rabbit",
    HAY: "hay",
    TRUCK: "truck",
    BARN: "barn",
    A: "symbol_a",
    K: "symbol_k",
    Q: "symbol_q",
    J: "symbol_j",
    TEN: "symbol_10",
    WILD: "wild",
    BONUS: "bonus",
    SCATTER: "scatter",
  };
  static readonly SYMBOL_WEIGHTS = {
    pig: 5,
    cow: 5,
    chicken: 6,
    rabbit: 6,
    hay: 8,
    truck: 10,
    barn: 12,
    symbol_a: 15,
    symbol_k: 15,
    symbol_q: 18,
    symbol_j: 18,
    symbol_10: 20,
    wild: 2,
    bonus: 3,
    scatter: 3,
  };

  static readonly PAYTABLE = {
    pig: { 3: 50, 4: 150, 5: 500 },
    cow: { 3: 50, 4: 150, 5: 500 },
    chicken: { 3: 40, 4: 120, 5: 400 },
    rabbit: { 3: 40, 4: 120, 5: 400 },
    hay: { 3: 30, 4: 100, 5: 300 },
    truck: { 3: 25, 4: 75, 5: 250 },
    barn: { 3: 20, 4: 60, 5: 200 },
    symbol_a: { 3: 15, 4: 40, 5: 150 },
    symbol_k: { 3: 15, 4: 40, 5: 150 },
    symbol_q: { 3: 10, 4: 30, 5: 100 },
    symbol_j: { 3: 10, 4: 30, 5: 100 },
    symbol_10: { 3: 5, 4: 20, 5: 80 },
    wild: { 3: 100, 4: 300, 5: 1000 },
    scatter: { 3: 10, 4: 50, 5: 200 },
  };
  static readonly SOUNDS = {
    SPIN: "spin",
    WIN: "win",
    LOSE: "lose",
  };

  static readonly ANIM = {
    SYMBOL_WIN_DURATION: 0.5,
    COIN_FLY_DURATION: 1.0,
    WIN_POPUP_DELAY: 0.5,
    NUMBER_COUNT_DURATION: 2.0,
  };

  static readonly GAME_STATES = {
    IDLE: "idle",
    SPINNING: "spinning",
    STOPPING: "stopping",
    WIN_SHOW: "win_show",
    BONUS_GAME: "bonus_game",
    FREE_SPINS: "free_spins",
  } as const;
}

export type GameState =
  (typeof GameConfig.GAME_STATES)[keyof typeof GameConfig.GAME_STATES];
