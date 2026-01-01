export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

const LOG_COLORS = {
  DEBUG: "color: #888",
  INFO: "color: #2196F3",
  WARN: "color: #FF9800",
  ERROR: "color: #F44336",
} as const;

const IS_PRODUCTION = (() => {
  // @ts-ignore - CC_DEBUG is a Cocos Creator constant
  if (typeof CC_DEBUG !== "undefined" && CC_DEBUG === false) {
    return true;
  }
  if (typeof window !== "undefined" && window.location) {
    const hostname = window.location.hostname;
    return !hostname.includes("localhost") && !hostname.includes("127.0.0.1");
  }
  return false;
})();

export class Logger {
  private static currentLevel: LogLevel = IS_PRODUCTION
    ? LogLevel.WARN
    : LogLevel.DEBUG;
  private static enableTimestamp: boolean = true;
  private static enableColors: boolean = true;

  // ==========================================
  // Configuration
  // ==========================================

  public static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  public static isProductionMode(): boolean {
    return IS_PRODUCTION;
  }

  public static setTimestamp(enabled: boolean): void {
    this.enableTimestamp = enabled;
  }

  public static setColors(enabled: boolean): void {
    this.enableColors = enabled;
  }

  // ==========================================
  // Logging Methods
  // ==========================================

  public static debug(
    context: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (IS_PRODUCTION) return;

    if (this.currentLevel <= LogLevel.DEBUG) {
      this.log("DEBUG", context, message, LOG_COLORS.DEBUG, ...args);
    }
  }

  public static info(
    context: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (IS_PRODUCTION) return;

    if (this.currentLevel <= LogLevel.INFO) {
      this.log("INFO", context, message, LOG_COLORS.INFO, ...args);
    }
  }

  public static warn(
    context: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (this.currentLevel <= LogLevel.WARN) {
      this.log("WARN", context, message, LOG_COLORS.WARN, ...args);
    }
  }

  public static error(
    context: string,
    message: string,
    ...args: unknown[]
  ): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      this.log("ERROR", context, message, LOG_COLORS.ERROR, ...args);
    }
  }

  // ==========================================
  // Internal Helpers
  // ==========================================

  private static log(
    level: string,
    context: string,
    message: string,
    color: string,
    ...args: unknown[]
  ): void {
    const prefix = this.buildLogPrefix(context);
    const fullMessage = `${prefix} ${level}: ${message}`;

    this.outputLog(level, fullMessage, ...args);
  }

  private static buildLogPrefix(context: string): string {
    const timestamp = this.enableTimestamp ? this.getFormattedTime() : "";
    return `${timestamp}[${context}]`;
  }

  private static getFormattedTime(): string {
    const now = new Date();
    const time = now.toISOString().split("T")[1].split(".")[0];
    return `[${time}]`;
  }

  private static outputLog(
    level: string,
    message: string,
    ...args: unknown[]
  ): void {
    switch (level) {
      case "ERROR":
        console.error(message, ...args);
        break;
      case "WARN":
        console.warn(message, ...args);
        break;
      default:
        console.log(message, ...args);
    }
  }

  // ==========================================
  // Factory Method
  // ==========================================

  public static create(context: string) {
    return {
      debug: (message: string, ...args: unknown[]) =>
        Logger.debug(context, message, ...args),
      info: (message: string, ...args: unknown[]) =>
        Logger.info(context, message, ...args),
      warn: (message: string, ...args: unknown[]) =>
        Logger.warn(context, message, ...args),
      error: (message: string, ...args: unknown[]) =>
        Logger.error(context, message, ...args),
    };
  }
}
