import {
  _decorator,
  Component,
  Node,
  resources,
  Size,
  Sprite,
  SpriteFrame,
  UITransform,
} from "cc";
import { GameConfig } from "../data/GameConfig";
import { ISymbolData, SymbolData } from "../data/SymbolData";
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
  private isInitialized: boolean = false;

  private readonly spriteFrameCache = new Map<string, SpriteFrame>();
  private readonly spriteFrameLoading = new Map<
    string,
    Promise<SpriteFrame | null>
  >();
  private readonly debugLogs: boolean = false;

  protected onDestroy(): void {
    this.clearSymbols();
    this.spriteFrameCache.clear();
    this.spriteFrameLoading.clear();
  }

  public init(): void {
    if (this.isInitialized) {
      return;
    }

    this.clearSymbols();
    this.createSymbols();
    this.initializeSymbolPositions();
    this.isInitialized = true;
  }

  private clearSymbols(): void {
    this.symbolNodes.forEach((node) => {
      if (node?.isValid) {
        node.destroy();
      }
    });
    this.symbolNodes = [];
  }

  private static shuffleInPlace<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }

  private createSymbols(): void {
    const randomSymbols = this.getRandomSymbols();
    this.symbolNodes = randomSymbols.map((symbol) =>
      this.createSymbolNode(symbol.id)
    );
  }

  private getRandomSymbols(): ISymbolData[] {
    const shuffled = [...SymbolData.getAllSymbols()];
    ReelContainer.shuffleInPlace(shuffled);
    return shuffled;
  }

  private createSymbolNode(symbolId: string): Node {
    const symbolNode = new Node(
      `${ReelContainer.SYMBOL_NAME_PREFIX}${symbolId}`
    );

    const uiTransform = symbolNode.addComponent(UITransform);
    uiTransform.setContentSize(this.symbolSize);
    uiTransform.setAnchorPoint(0.5, 0.5);

    const sprite = symbolNode.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    this.setSymbolOnNode(symbolNode, symbolId);

    symbolNode.setParent(this.node);
    return symbolNode;
  }

  private parseSymbolIdFromNodeName(nodeName: string): string {
    if (!nodeName.startsWith(ReelContainer.SYMBOL_NAME_PREFIX)) return "";
    return nodeName.slice(ReelContainer.SYMBOL_NAME_PREFIX.length);
  }

  private setSymbolOnNode(node: Node, symbolId: string): void {
    node.name = `${ReelContainer.SYMBOL_NAME_PREFIX}${symbolId}`;
    this.loadSpriteFrame(node, symbolId);
  }

  private loadSpriteFrame(node: Node, symbolId: string): void {
    const sprite = node.getComponent(Sprite);
    const symbolData = SymbolData.getSymbol(symbolId);
    if (!sprite || !symbolData) return;

    const cached = this.spriteFrameCache.get(symbolId);
    if (cached) {
      sprite.spriteFrame = cached;
      return;
    }

    const existing = this.spriteFrameLoading.get(symbolId);
    const loader =
      existing ??
      new Promise<SpriteFrame | null>((resolve) => {
        resources.load(
          `${symbolData.spritePath}/spriteFrame`,
          SpriteFrame,
          (err, spriteFrame) => {
            if (err || !spriteFrame) {
              resolve(null);
              return;
            }
            resolve(spriteFrame);
          }
        );
      });

    if (!existing) {
      this.spriteFrameLoading.set(symbolId, loader);
      // Cleanup (without Promise.finally for older TS target)
      loader.then(
        () => this.spriteFrameLoading.delete(symbolId),
        () => this.spriteFrameLoading.delete(symbolId)
      );
    }

    loader.then((spriteFrame) => {
      if (!spriteFrame) return;
      this.spriteFrameCache.set(symbolId, spriteFrame);
      if (node?.isValid && sprite?.isValid) {
        sprite.spriteFrame = spriteFrame;
      }
    });
  }

  private initializeSymbolPositions(): void {
    const centerIndex = Math.floor(this.symbolNodes.length / 2);
    this.symbolNodes.forEach((node, index) => {
      const yPosition = (centerIndex - index) * this.symbolSpacing;
      const currentPos = node.position;
      node.setPosition(currentPos.x, yPosition, currentPos.z);
    });
  }

  private getTargetVisibleYs(): number[] {
    const visibleCount = GameConfig.SYMBOL_PER_REEL;
    const half = (visibleCount - 1) / 2;
    const ys: number[] = [];
    for (let row = 0; row < visibleCount; row++) {
      ys.push((half - row) * this.symbolSpacing);
    }
    return ys;
  }

  private pickClosestNodesByY(nodes: Node[], targetYs: number[]): Node[] {
    const remaining = [...nodes];
    const picked: Node[] = [];

    targetYs.forEach((targetY) => {
      if (!remaining.length) return;
      let bestIdx = 0;
      let bestDist = Math.abs(remaining[0].position.y - targetY);
      for (let i = 1; i < remaining.length; i++) {
        const d = Math.abs(remaining[i].position.y - targetY);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      const [best] = remaining.splice(bestIdx, 1);
      picked.push(best);
    });

    // Ensure ordering top->bottom by Y (descending)
    return picked.sort((a, b) => b.position.y - a.position.y);
  }

  public getVisibleSymbolNodes(): Node[] {
    const nodes = this.symbolNodes.filter((n) => n?.isValid);
    if (!nodes.length) return [];
    return this.pickClosestNodesByY(nodes, this.getTargetVisibleYs());
  }

  public getVisibleSymbols(): string[] {
    const visibleNodes = this.getVisibleSymbolNodes();
    if (!visibleNodes.length) return [];

    return visibleNodes.map((node) => {
      return this.parseSymbolIdFromNodeName(node.name);
    });
  }

  public getSymbolNodes(): Node[] {
    return this.symbolNodes;
  }

  public reset(): void {
    this.isInitialized = false;
    this.clearSymbols();
  }

  public setVisibleSymbols(symbols: string[]): void {
    if (!this.symbolNodes.length || symbols.length === 0) return;
    const visibleNodes = this.getVisibleSymbolNodes();

    symbols.forEach((symbolId, index) => {
      if (index < visibleNodes.length) {
        const node = visibleNodes[index];
        if (node?.isValid) {
          const oldName = node.name;
          this.setSymbolOnNode(node, symbolId);
          if (this.debugLogs) {
            console.log(
              `[ReelContainer] Updated node ${index}: ${oldName} -> ${node.name}`
            );
          }
        }
      }
    });
  }
}
