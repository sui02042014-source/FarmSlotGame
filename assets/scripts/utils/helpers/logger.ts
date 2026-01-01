export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

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
  private static isProduction: boolean = IS_PRODUCTION;

  public static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  public static isProductionMode(): boolean {
    return this.isProduction;
  }

  public static setTimestamp(enabled: boolean): void {
    this.enableTimestamp = enabled;
  }

  public static setColors(enabled: boolean): void {
    this.enableColors = enabled;
  }

  public static debug(context: string, message: string, ...args: any[]): void {
    if (this.isProduction) return;

    if (this.currentLevel <= LogLevel.DEBUG) {
      this.log("DEBUG", context, message, "color: #888", ...args);
    }
  }

  public static info(context: string, message: string, ...args: any[]): void {
    if (this.isProduction) return;

    if (this.currentLevel <= LogLevel.INFO) {
      this.log("INFO", context, message, "color: #2196F3", ...args);
    }
  }

  public static warn(context: string, message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      this.log("WARN", context, message, "color: #FF9800", ...args);
    }
  }

  public static error(context: string, message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.ERROR) {
      this.log("ERROR", context, message, "color: #F44336", ...args);
    }
  }

  private static log(
    level: string,
    context: string,
    message: string,
    color: string,
    ...args: any[]
  ): void {
    const timestamp = this.enableTimestamp
      ? `[${new Date().toISOString().split("T")[1].split(".")[0]}]`
      : "";

    const prefix = `${timestamp}[${context}]`;

    if (this.enableColors && typeof window !== "undefined") {
    } else {
      const fullMessage = `${prefix} ${level}: ${message}`;

      switch (level) {
        case "ERROR":
          console.error(fullMessage, ...args);
          break;
        case "WARN":
          console.warn(fullMessage, ...args);
          break;
        default:
          console.log(fullMessage, ...args);
      }
    }
  }

  public static create(context: string) {
    return {
      debug: (message: string, ...args: any[]) =>
        Logger.debug(context, message, ...args),
      info: (message: string, ...args: any[]) =>
        Logger.info(context, message, ...args),
      warn: (message: string, ...args: any[]) =>
        Logger.warn(context, message, ...args),
      error: (message: string, ...args: any[]) =>
        Logger.error(context, message, ...args),
    };
  }
}
