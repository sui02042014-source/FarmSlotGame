import { SpriteFrameCache } from "./sprite-frame-cache";
import { SymbolData } from "../../data/models/symbol-data";
import { Logger } from "./logger";

const logger = Logger.create("SymbolPreloader");

const PRELOAD_CONSTANTS = {
  BUNDLE_NAME: "symbols",
  SPRITE_FRAME_SUFFIX: "/spriteFrame",
} as const;

export class SymbolPreloader {
  public static async preloadAll(): Promise<void> {
    try {
      const cache = SpriteFrameCache.getInstance();
      const allSymbols = SymbolData.getAllSymbols();

      await Promise.all(
        allSymbols.map((symbol) => this.preloadSymbol(cache, symbol.spritePath))
      );

      logger.info(`Successfully preloaded ${allSymbols.length} symbols`);
    } catch (error) {
      logger.error("Failed to preload symbols:", error);
      throw error;
    }
  }

  private static async preloadSymbol(
    cache: SpriteFrameCache,
    spritePath: string
  ): Promise<void> {
    const fullPath = `${spritePath}${PRELOAD_CONSTANTS.SPRITE_FRAME_SUFFIX}`;
    await cache.getSpriteFrameFromBundle(
      PRELOAD_CONSTANTS.BUNDLE_NAME,
      fullPath
    );
  }
}
