import { _decorator, Component, Node, Size, Sprite, UITransform } from "cc";
import { GameConfig } from "../data/GameConfig";
import { SymbolData, ISymbolData } from "../data/SymbolData";
import { SpriteFrameCache } from "../utils/SpriteFrameCache";
const { ccclass } = _decorator;

@ccclass("ReelContainer")
export class ReelContainer extends Component {
  private static readonly SYMBOL_NAME_PREFIX = "Symbol_";

  private readonly symbolSpacing =
    GameConfig.SYMBOL_SIZE + GameConfig.SYMBOL_SPACING;

  private readonly symbolSize = new Size(
    GameConfig.SYMBOL_SIZE,
    GameConfig.SYMBOL_SIZE
  );

  private symbolNodes: Node[] = [];

  private readonly spriteFrameCache = SpriteFrameCache.getInstance();

  public init(): void {
    this.cleanupSymbolNodes();
    const shuffledSymbols = this.shuffleSymbols(SymbolData.getAllSymbols());
    this.symbolNodes = this.createSymbolNodes(shuffledSymbols);
  }

  public getSymbolNodes(): Node[] {
    return this.symbolNodes;
  }

  public reset(): void {
    this.cleanupSymbolNodes();
  }

  private cleanupSymbolNodes(): void {
    this.symbolNodes.forEach((node) => {
      if (node?.isValid) {
        node.destroy();
      }
    });
    this.symbolNodes = [];
  }

  private shuffleSymbols(symbols: ISymbolData[]): ISymbolData[] {
    const shuffled = [...symbols];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  private createSymbolNodes(symbols: ISymbolData[]): Node[] {
    const centerIndex = Math.floor(symbols.length / 2);

    return symbols.map((symbol, index) => {
      const node = this.createSymbolNode(symbol);
      const yPosition = (centerIndex - index) * this.symbolSpacing;

      node.setParent(this.node);
      node.setPosition(node.position.x, yPosition, node.position.z);

      this.loadSpriteFrame(node, symbol.id);

      return node;
    });
  }

  private createSymbolNode(symbol: ISymbolData): Node {
    const nodeName = `${ReelContainer.SYMBOL_NAME_PREFIX}${symbol.id}`;
    const node = new Node(nodeName);

    const uiTransform = node.addComponent(UITransform);
    uiTransform.setContentSize(this.symbolSize);
    uiTransform.setAnchorPoint(0.5, 0.5);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    return node;
  }

  private async loadSpriteFrame(node: Node, symbolId: string): Promise<void> {
    const sprite = node.getComponent(Sprite);
    const symbolData = SymbolData.getSymbol(symbolId);

    if (!sprite || !symbolData) {
      console.warn(
        `Failed to load sprite for symbol ${symbolId}: missing sprite or symbol data`
      );
      return;
    }

    try {
      const path = `${symbolData.spritePath}/spriteFrame`;
      const spriteFrame = await this.spriteFrameCache.getSpriteFrameFromBundle(
        "symbols",
        path
      );

      if (spriteFrame && node?.isValid && sprite?.isValid) {
        sprite.spriteFrame = spriteFrame;
      }
    } catch (error) {
      console.error(`Error loading sprite frame for ${symbolId}:`, error);
    }
  }

  protected onDestroy(): void {
    this.cleanupSymbolNodes();
  }
}
