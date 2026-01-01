import { _decorator } from "cc";
const { ccclass } = _decorator;

export interface ISymbolData {
  id: string;
  name: string;
  type: SymbolType;
  value: number;
  spritePath: string;
  weight: number;
  paytable: Record<number, number>;
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

const SPECIAL_SYMBOL_TYPES: readonly SymbolType[] = [
  SymbolType.WILD,
  SymbolType.BONUS,
  SymbolType.SCATTER,
];

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
        weight: 5,
        paytable: { 3: 50, 4: 150, 5: 500 },
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
        weight: 5,
        paytable: { 3: 50, 4: 150, 5: 500 },
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
        weight: 6,
        paytable: { 3: 40, 4: 120, 5: 400 },
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
        weight: 6,
        paytable: { 3: 40, 4: 120, 5: 400 },
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
        weight: 8,
        paytable: { 3: 30, 4: 100, 5: 300 },
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
        weight: 10,
        paytable: { 3: 25, 4: 75, 5: 250 },
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
        weight: 12,
        paytable: { 3: 20, 4: 60, 5: 200 },
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
        weight: 15,
        paytable: { 3: 15, 4: 40, 5: 150 },
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
        weight: 15,
        paytable: { 3: 15, 4: 40, 5: 150 },
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
        weight: 18,
        paytable: { 3: 10, 4: 30, 5: 100 },
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
        weight: 18,
        paytable: { 3: 10, 4: 30, 5: 100 },
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
        weight: 20,
        paytable: { 3: 5, 4: 20, 5: 80 },
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
        weight: 2,
        paytable: { 3: 100, 4: 300, 5: 1000 },
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
        weight: 3,
        paytable: { 3: 0, 4: 0, 5: 0 },
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
        weight: 3,
        paytable: { 3: 10, 4: 50, 5: 200 },
      },
    ],
  ]);

  private static cachedSymbols: ISymbolData[] | null = null;

  // ==========================================
  // Basic Getters
  // ==========================================

  static getSymbol(id: string): ISymbolData | undefined {
    return this.symbols.get(id);
  }

  static getAllSymbols(): ISymbolData[] {
    if (!this.cachedSymbols) {
      this.cachedSymbols = Array.from(this.symbols.values());
    }
    return this.cachedSymbols;
  }

  static getSymbolCount(): number {
    return this.symbols.size;
  }

  // ==========================================
  // Type Filtering
  // ==========================================

  static getSymbolsByType(type: SymbolType): ISymbolData[] {
    return this.getAllSymbols().filter((symbol) => symbol.type === type);
  }

  static isSpecialSymbol(id: string): boolean {
    const symbol = this.getSymbol(id);
    return symbol ? SPECIAL_SYMBOL_TYPES.includes(symbol.type) : false;
  }

  static canSubstitute(id: string): boolean {
    const symbol = this.getSymbol(id);
    return symbol ? symbol.type === SymbolType.WILD : false;
  }

  // ==========================================
  // Weight & Paytable Getters
  // ==========================================

  static getAllWeights(): Record<string, number> {
    const weights: Record<string, number> = {};
    this.symbols.forEach((symbol, id) => {
      weights[id] = symbol.weight;
    });
    return weights;
  }

  static getPaytable(id: string): Record<number, number> | undefined {
    return this.getSymbol(id)?.paytable;
  }

  static getAllPaytables(): Record<string, Record<number, number>> {
    const paytables: Record<string, Record<number, number>> = {};
    this.symbols.forEach((symbol, id) => {
      paytables[id] = symbol.paytable;
    });
    return paytables;
  }
}
