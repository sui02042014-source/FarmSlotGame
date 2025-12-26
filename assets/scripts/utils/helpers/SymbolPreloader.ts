import { SpriteFrameCache } from "./SpriteFrameCache";
import { SymbolData } from "../../data/models/SymbolData";

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
