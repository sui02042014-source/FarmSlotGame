export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

export class Logger {
  private static currentLevel: LogLevel = LogLevel.INFO;
  private static enableTimestamp: boolean = true;
  private static enableColors: boolean = true;

  /**
   * Set the minimum log level to display
   */
  public static setLevel(level: LogLevel): void {
    this.currentLevel = level;
  }

  /**
   * Enable or disable timestamps in logs
   */
  public static setTimestamp(enabled: boolean): void {
    this.enableTimestamp = enabled;
  }

  /**
   * Enable or disable colors in logs (for web console)
   */
  public static setColors(enabled: boolean): void {
    this.enableColors = enabled;
  }

  /**
   * Log debug message
   */
  public static debug(context: string, message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.DEBUG) {
      this.log("DEBUG", context, message, "color: #888", ...args);
    }
  }

  /**
   * Log info message
   */
  public static info(context: string, message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.INFO) {
      this.log("INFO", context, message, "color: #2196F3", ...args);
    }
  }

  /**
   * Log warning message
   */
  public static warn(context: string, message: string, ...args: any[]): void {
    if (this.currentLevel <= LogLevel.WARN) {
      this.log("WARN", context, message, "color: #FF9800", ...args);
    }
  }

  /**
   * Log error message
   */
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
      console.log(`%c${prefix} ${level}: ${message}`, color, ...args);
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

  /**
   * Create a logger instance bound to a specific context
   */
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
