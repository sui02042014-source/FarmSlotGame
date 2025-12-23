import { _decorator } from "cc";
const { ccclass } = _decorator;

export interface ISymbolData {
  id: string;
  name: string;
  type: SymbolType;
  value: number;
  spritePath: string;
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
        value: 500,
        spritePath: "9_Pig",
      },
    ],
    [
      "cow",
      {
        id: "cow",
        name: "Cow",
        type: SymbolType.HIGH_VALUE,
        value: 500,
        spritePath: "10_Cow",
      },
    ],
    [
      "chicken",
      {
        id: "chicken",
        name: "Chicken",
        type: SymbolType.HIGH_VALUE,
        value: 400,
        spritePath: "7_Hen",
      },
    ],
    [
      "rabbit",
      {
        id: "rabbit",
        name: "Rabbit",
        type: SymbolType.HIGH_VALUE,
        value: 400,
        spritePath: "8_Rabbit",
      },
    ],
    [
      "hay",
      {
        id: "hay",
        name: "Hay",
        type: SymbolType.HIGH_VALUE,
        value: 300,
        spritePath: "6_Cart_with_hay",
      },
    ],
    [
      "truck",
      {
        id: "truck",
        name: "Truck",
        type: SymbolType.MEDIUM_VALUE,
        value: 250,
        spritePath: "11_Truck",
      },
    ],
    [
      "barn",
      {
        id: "barn",
        name: "Barn (placeholder)",
        type: SymbolType.MEDIUM_VALUE,
        value: 200,
        spritePath: "13_Bonus_Mill",
      },
    ],
    [
      "symbol_a",
      {
        id: "symbol_a",
        name: "A",
        type: SymbolType.LOW_VALUE,
        value: 150,
        spritePath: "5_Tomato",
      },
    ],
    [
      "symbol_k",
      {
        id: "symbol_k",
        name: "K",
        type: SymbolType.LOW_VALUE,
        value: 150,
        spritePath: "4_Eggplant",
      },
    ],
    [
      "symbol_q",
      {
        id: "symbol_q",
        name: "Q",
        type: SymbolType.LOW_VALUE,
        value: 100,
        spritePath: "3_Watermelon",
      },
    ],
    [
      "symbol_j",
      {
        id: "symbol_j",
        name: "J",
        type: SymbolType.LOW_VALUE,
        value: 100,
        spritePath: "2_Carrot",
      },
    ],
    [
      "symbol_10",
      {
        id: "symbol_10",
        name: "10",
        type: SymbolType.LOW_VALUE,
        value: 80,
        spritePath: "1_Pumpkin",
      },
    ],
    [
      "wild",
      {
        id: "wild",
        name: "Wild",
        type: SymbolType.WILD,
        value: 1000,
        spritePath: "12_Wild_Girl",
        animationPath: "animations/wild_anim",
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
      },
    ],
    [
      "scatter",
      {
        id: "scatter",
        name: "Scatter",
        type: SymbolType.SCATTER,
        value: 200,
        spritePath: "Experience_star",
        animationPath: "animations/scatter_anim",
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
