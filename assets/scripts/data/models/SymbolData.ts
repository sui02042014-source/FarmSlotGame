import { _decorator } from "cc";
import { GameConfig } from "../config/GameConfig";
const { ccclass } = _decorator;

export interface ISymbolData {
  id: string;
  name: string;
  type: SymbolType;
  value: number; // Max win value from paytable (for 5 symbols)
  spritePath: string;
  weight: number;
  animationPath?: string;
}

export enum SymbolType {
  HIGH_VALUE = "high_value",
  MEDIUM_VALUE = "medium_value",
  LOW_VALUE = "low_value",
  WILD = "wild",
  BONUS = "bonus",
  SCATTER = "scatter",
}

@ccclass("SymbolData")
export class SymbolData {
  private static readonly symbols: Map<string, ISymbolData> = new Map([
    [
      "pig",
      {
        id: "pig",
        name: "Pig",
        type: SymbolType.HIGH_VALUE,
        value: GameConfig.PAYTABLE.pig[5],
        spritePath: "9_Pig",
        weight: GameConfig.SYMBOL_WEIGHTS.pig,
      },
    ],
    [
      "cow",
      {
        id: "cow",
        name: "Cow",
        type: SymbolType.HIGH_VALUE,
        value: GameConfig.PAYTABLE.cow[5],
        spritePath: "10_Cow",
        weight: GameConfig.SYMBOL_WEIGHTS.cow,
      },
    ],
    [
      "chicken",
      {
        id: "chicken",
        name: "Chicken",
        type: SymbolType.HIGH_VALUE,
        value: GameConfig.PAYTABLE.chicken[5],
        spritePath: "7_Hen",
        weight: GameConfig.SYMBOL_WEIGHTS.chicken,
      },
    ],
    [
      "rabbit",
      {
        id: "rabbit",
        name: "Rabbit",
        type: SymbolType.HIGH_VALUE,
        value: GameConfig.PAYTABLE.rabbit[5],
        spritePath: "8_Rabbit",
        weight: GameConfig.SYMBOL_WEIGHTS.rabbit,
      },
    ],
    [
      "hay",
      {
        id: "hay",
        name: "Hay",
        type: SymbolType.HIGH_VALUE,
        value: GameConfig.PAYTABLE.hay[5],
        spritePath: "6_Cart_with_hay",
        weight: GameConfig.SYMBOL_WEIGHTS.hay,
      },
    ],
    [
      "truck",
      {
        id: "truck",
        name: "Truck",
        type: SymbolType.MEDIUM_VALUE,
        value: GameConfig.PAYTABLE.truck[5],
        spritePath: "11_Truck",
        weight: GameConfig.SYMBOL_WEIGHTS.truck,
      },
    ],
    [
      "barn",
      {
        id: "barn",
        name: "Barn (placeholder)",
        type: SymbolType.MEDIUM_VALUE,
        value: GameConfig.PAYTABLE.barn[5],
        spritePath: "13_Bonus_Mill",
        weight: GameConfig.SYMBOL_WEIGHTS.barn,
      },
    ],
    [
      "symbol_a",
      {
        id: "symbol_a",
        name: "A",
        type: SymbolType.LOW_VALUE,
        value: GameConfig.PAYTABLE.symbol_a[5],
        spritePath: "5_Tomato",
        weight: GameConfig.SYMBOL_WEIGHTS.symbol_a,
      },
    ],
    [
      "symbol_k",
      {
        id: "symbol_k",
        name: "K",
        type: SymbolType.LOW_VALUE,
        value: GameConfig.PAYTABLE.symbol_k[5],
        spritePath: "4_Eggplant",
        weight: GameConfig.SYMBOL_WEIGHTS.symbol_k,
      },
    ],
    [
      "symbol_q",
      {
        id: "symbol_q",
        name: "Q",
        type: SymbolType.LOW_VALUE,
        value: GameConfig.PAYTABLE.symbol_q[5],
        spritePath: "3_Watermelon",
        weight: GameConfig.SYMBOL_WEIGHTS.symbol_q,
      },
    ],
    [
      "symbol_j",
      {
        id: "symbol_j",
        name: "J",
        type: SymbolType.LOW_VALUE,
        value: GameConfig.PAYTABLE.symbol_j[5],
        spritePath: "2_Carrot",
        weight: GameConfig.SYMBOL_WEIGHTS.symbol_j,
      },
    ],
    [
      "symbol_10",
      {
        id: "symbol_10",
        name: "10",
        type: SymbolType.LOW_VALUE,
        value: GameConfig.PAYTABLE.symbol_10[5],
        spritePath: "1_Pumpkin",
        weight: GameConfig.SYMBOL_WEIGHTS.symbol_10,
      },
    ],
    [
      "wild",
      {
        id: "wild",
        name: "Wild",
        type: SymbolType.WILD,
        value: GameConfig.PAYTABLE.wild[5],
        spritePath: "12_Wild_Girl",
        animationPath: "animations/wild_anim",
        weight: GameConfig.SYMBOL_WEIGHTS.wild,
      },
    ],
    [
      "bonus",
      {
        id: "bonus",
        name: "Bonus",
        type: SymbolType.BONUS,
        value: 0,
        spritePath: "13_Bonus_Mill",
        animationPath: "animations/bonus_anim",
        weight: GameConfig.SYMBOL_WEIGHTS.bonus,
      },
    ],
    [
      "scatter",
      {
        id: "scatter",
        name: "Scatter",
        type: SymbolType.SCATTER,
        value: GameConfig.PAYTABLE.scatter[5],
        spritePath: "Experience_star",
        animationPath: "animations/scatter_anim",
        weight: GameConfig.SYMBOL_WEIGHTS.scatter,
      },
    ],
  ]);

  static getSymbol(id: string): ISymbolData | undefined {
    return this.symbols.get(id);
  }

  static getAllSymbols(): ISymbolData[] {
    return Array.from(this.symbols.values());
  }

  static getSymbolCount(): number {
    return this.symbols.size;
  }

  static getSymbolsByType(type: SymbolType): ISymbolData[] {
    return this.getAllSymbols().filter((symbol) => symbol.type === type);
  }

  static isSpecialSymbol(id: string): boolean {
    const symbol = this.getSymbol(id);
    return symbol
      ? [SymbolType.WILD, SymbolType.BONUS, SymbolType.SCATTER].includes(
          symbol.type
        )
      : false;
  }

  static canSubstitute(id: string): boolean {
    const symbol = this.getSymbol(id);
    return symbol ? symbol.type === SymbolType.WILD : false;
  }
}
