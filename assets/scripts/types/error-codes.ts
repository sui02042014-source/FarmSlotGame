export enum ErrorCode {
  SPIN_FAILED = "E001",
  SPIN_ALREADY_IN_PROGRESS = "E002",
  SPIN_INVALID_STATE = "E003",
  NETWORK_ERROR = "E100",
  NETWORK_TIMEOUT = "E101",
  NETWORK_DISCONNECTED = "E102",
  INSUFFICIENT_FUNDS = "E200",
  WALLET_SYNC_FAILED = "E201",
  TRANSACTION_FAILED = "E202",
  INVALID_BET_AMOUNT = "E203",
  ASSET_LOAD_FAILED = "E300",
  ASSET_NOT_FOUND = "E301",
  BUNDLE_LOAD_FAILED = "E302",
  INVALID_GAME_STATE = "E400",
  GAME_PAUSED = "E401",
  GAME_NOT_INITIALIZED = "E402",
  AUDIO_LOAD_FAILED = "E500",
  AUDIO_PLAY_FAILED = "E501",
  UNKNOWN_ERROR = "E999",
}

export interface GameError {
  code: ErrorCode;
  message: string;
  details?: any;
  timestamp: number;
}

export class GameErrorHandler {
  public static createError(
    code: ErrorCode,
    message: string,
    details?: any
  ): GameError {
    return {
      code,
      message,
      details,
      timestamp: Date.now(),
    };
  }

  public static getUserMessage(code: ErrorCode): string {
    const messages: Record<ErrorCode, string> = {
      [ErrorCode.SPIN_FAILED]: "Spin failed. Please try again.",
      [ErrorCode.SPIN_ALREADY_IN_PROGRESS]:
        "Please wait for the current spin to complete.",
      [ErrorCode.SPIN_INVALID_STATE]: "Cannot spin at this time.",
      [ErrorCode.NETWORK_ERROR]:
        "Connection error. Please check your internet.",
      [ErrorCode.NETWORK_TIMEOUT]: "Request timed out. Please try again.",
      [ErrorCode.NETWORK_DISCONNECTED]: "You are offline. Please reconnect.",
      [ErrorCode.INSUFFICIENT_FUNDS]: "Not enough coins to place this bet.",
      [ErrorCode.WALLET_SYNC_FAILED]:
        "Failed to sync wallet. Your progress is saved locally.",
      [ErrorCode.TRANSACTION_FAILED]: "Transaction failed. Please try again.",
      [ErrorCode.INVALID_BET_AMOUNT]: "Invalid bet amount.",
      [ErrorCode.ASSET_LOAD_FAILED]: "Failed to load game assets.",
      [ErrorCode.ASSET_NOT_FOUND]: "Required asset not found.",
      [ErrorCode.BUNDLE_LOAD_FAILED]: "Failed to load game resources.",
      [ErrorCode.INVALID_GAME_STATE]: "Invalid game state.",
      [ErrorCode.GAME_PAUSED]: "Game is paused.",
      [ErrorCode.GAME_NOT_INITIALIZED]: "Game not initialized.",
      [ErrorCode.AUDIO_LOAD_FAILED]: "Failed to load audio.",
      [ErrorCode.AUDIO_PLAY_FAILED]: "Failed to play audio.",
      [ErrorCode.UNKNOWN_ERROR]: "An unexpected error occurred.",
    };

    return messages[code] || messages[ErrorCode.UNKNOWN_ERROR];
  }
}
