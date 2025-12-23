import { SpriteFrameCache } from "./SpriteFrameCache";
import { SymbolData } from "../data/SymbolData";

export class SymbolPreloader {
  public static async preloadAll(): Promise<void> {
    const cache = SpriteFrameCache.getInstance();
    const spritePaths: string[] = [];

    const allSymbols = SymbolData.getAllSymbols();
    allSymbols.forEach((symbol) => {
      spritePaths.push(`${symbol.spritePath}/spriteFrame`);
    });

    await Promise.all(
      spritePaths.map((p) => cache.getSpriteFrameFromBundle("symbols", p))
    );
  }
}
