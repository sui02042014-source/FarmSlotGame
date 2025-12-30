import { SpriteFrameCache } from "./sprite-frame-cache";
import { SymbolData } from "../../data/models/symbol-data";

export class SymbolPreloader {
  public static async preloadAll(): Promise<void> {
    const cache = SpriteFrameCache.getInstance();
    const allSymbols = SymbolData.getAllSymbols();

    await Promise.all(
      allSymbols.map((symbol) =>
        cache.getSpriteFrameFromBundle(
          "symbols",
          `${symbol.spritePath}/spriteFrame`
        )
      )
    );
  }
}
