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
  static readonly DEFAULT_BET_INDEX = 3; // 3.5
  static readonly DEFAULT_COINS = 1000;

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
  } as const;

  static readonly SOUNDS = {
    SPIN: "spin",
    WIN: "win",
    LOSE: "lose",
  };

  static readonly ANIM = {
    SYMBOL_WIN_DURATION: 0.5,
    COIN_FLY_DURATION: 1.0,
    WIN_POPUP_DELAY: 1,
    NUMBER_COUNT_DURATION: 2.0,
  };

  static readonly EFFECTS = {
    COIN_FLY_COUNT: 20,
    COIN_SCATTER_RADIUS: 150,
    COIN_SIZE: 60,
    WIN_SHOW_DURATION: 2.0,
    COIN_SPRITE_PATH: "ui/win/coin_icon/spriteFrame",
  };

  static readonly GAMEPLAY = {
    AUTO_PLAY_DELAY: 3.5,
    BIG_WIN_THRESHOLD: 1000,
    IDLE_FPS_THRESHOLD: 10, // seconds
    IDLE_FPS: 30,
    ACTIVE_FPS: 60,
  };

  static readonly NETWORK = {
    ENABLE_FAKE_LATENCY: false, // Set to true for testing
    MIN_LATENCY_MS: 500,
    MAX_LATENCY_MS: 1500,
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
