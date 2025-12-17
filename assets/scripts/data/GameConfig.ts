import { _decorator } from "cc";
const { ccclass } = _decorator;

@ccclass("GameConfig")
export class GameConfig {
  // ========== SLOT CONFIGURATION ==========
  static readonly REEL_COUNT = 5; // Số cột
  static readonly SYMBOL_PER_REEL = 3; // Số symbol hiển thị mỗi cột
  static readonly SYMBOL_SIZE = 200; // Kích thước mỗi symbol (giảm từ 240 xuống 200)
  static readonly SYMBOL_SPACING = 50; // Khoảng cách giữa symbols (giảm tỷ lệ từ 20)

  // ========== SPIN CONFIGURATION ==========
  static readonly SPIN_DURATION = 2.0; // Thời gian spin (giây)
  static readonly REEL_STOP_DELAY = 0.03; // Delay giữa các reel dừng - giảm để nhanh hơn
  static readonly SPIN_SPEED_MIN = 1700; // Tốc độ spin min (px/s) - giảm theo tỷ lệ symbol
  static readonly SPIN_SPEED_MAX = 3000; // Tốc độ spin max (px/s) - giảm theo tỷ lệ symbol
  static readonly BOUNCE_DURATION = 0.2; // Thời gian bounce khi dừng

  // ========== BET CONFIGURATION ==========
  static readonly MIN_BET = 0.5; // Cược tối thiểu
  static readonly MAX_BET = 100.0; // Cược tối đa
  static readonly BET_STEPS = [
    // Các mức cượ
    0.5, 1.0, 2.0, 3.5, 5.0, 10.0, 25.0, 50.0, 100.0,
  ];

  // ========== SYMBOL TYPES ==========
  static readonly SYMBOL_TYPES = {
    // High Value Symbols
    PIG: "pig",
    COW: "cow",
    CHICKEN: "chicken",
    RABBIT: "rabbit",
    HAY: "hay",

    // Medium Value Symbols
    TRUCK: "truck",
    BARN: "barn",

    // Low Value Symbols
    A: "symbol_a", // Apple
    K: "symbol_k", // Eggplant
    Q: "symbol_q", // Watermelon
    J: "symbol_j", // Carrot
    TEN: "symbol_10", // Pumpkin

    // Special Symbols
    WILD: "wild", // Farmer girl
    BONUS: "bonus", // Windmill
    SCATTER: "scatter", // Star
  };

  // ========== SYMBOL WEIGHTS (Tỷ lệ xuất hiện) ==========
  static readonly SYMBOL_WEIGHTS = {
    // High Value - Hiếm (5-8%)
    pig: 5,
    cow: 5,
    chicken: 6,
    rabbit: 6,
    hay: 8,

    // Medium Value - Trung bình (10-12%)
    truck: 10,
    barn: 12,

    // Low Value - Nhiều (15-20%)
    symbol_a: 15,
    symbol_k: 15,
    symbol_q: 18,
    symbol_j: 18,
    symbol_10: 20,

    // Special - Rất hiếm (2-3%)
    wild: 2,
    bonus: 3,
    scatter: 3,
  };

  // ========== PAYTABLE (Bảng trả thưởng) ==========
  // Multiply với bet amount
  static readonly PAYTABLE = {
    // High Value Symbols
    pig: { 3: 50, 4: 150, 5: 500 },
    cow: { 3: 50, 4: 150, 5: 500 },
    chicken: { 3: 40, 4: 120, 5: 400 },
    rabbit: { 3: 40, 4: 120, 5: 400 },
    hay: { 3: 30, 4: 100, 5: 300 },

    // Medium Value Symbols
    truck: { 3: 25, 4: 75, 5: 250 },
    barn: { 3: 20, 4: 60, 5: 200 },

    // Low Value Symbols
    symbol_a: { 3: 15, 4: 40, 5: 150 },
    symbol_k: { 3: 15, 4: 40, 5: 150 },
    symbol_q: { 3: 10, 4: 30, 5: 100 },
    symbol_j: { 3: 10, 4: 30, 5: 100 },
    symbol_10: { 3: 5, 4: 20, 5: 80 },

    // Special Symbols
    wild: { 3: 100, 4: 300, 5: 1000 }, // Wild cũng có trả thưởng
    scatter: { 3: 10, 4: 50, 5: 200 }, // Scatter anywhere
  };

  // ========== AUDIO ==========
  static readonly SOUNDS = {
    BUTTON_CLICK: "button_click",
    SPIN_START: "spin_start",
    REEL_STOP: "reel_stop",
    WIN_SMALL: "win_small",
    WIN_BIG: "win_big",
    WIN_MEGA: "win_mega",
    BONUS_TRIGGER: "bonus_trigger",
    COIN_COUNT: "coin_count",
  };

  // ========== ANIMATION DURATIONS ==========
  static readonly ANIM = {
    SYMBOL_WIN_DURATION: 0.5,
    COIN_FLY_DURATION: 1.0,
    WIN_POPUP_DELAY: 0.5,
    NUMBER_COUNT_DURATION: 2.0,
  };

  // ========== GAME STATES ==========
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
