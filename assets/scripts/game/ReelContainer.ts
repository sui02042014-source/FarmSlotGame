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
import { SymbolData } from "../data/SymbolData";
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
    this.symbolNodes.forEach((node) => {
      if (node?.isValid) node.destroy();
    });
    this.symbolNodes = [];
    this.spriteFrameCache.clear();
    this.spriteFrameLoading.clear();
  }

  public init(): void {
    if (this.isInitialized) return;

    this.symbolNodes.forEach((node) => {
      if (node?.isValid) node.destroy();
    });
    this.symbolNodes = [];

    const allSymbols = SymbolData.getAllSymbols();
    for (let i = allSymbols.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allSymbols[i], allSymbols[j]] = [allSymbols[j], allSymbols[i]];
    }

    const centerIndex = Math.floor(allSymbols.length / 2);
    this.symbolNodes = allSymbols.map((symbol, index) => {
      const node = new Node(`${ReelContainer.SYMBOL_NAME_PREFIX}${symbol.id}`);
      const uiTransform = node.addComponent(UITransform);
      uiTransform.setContentSize(this.symbolSize);
      uiTransform.setAnchorPoint(0.5, 0.5);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      node.name = `${ReelContainer.SYMBOL_NAME_PREFIX}${symbol.id}`;
      this.loadSpriteFrame(node, symbol.id);
      node.setParent(this.node);
      const yPosition = (centerIndex - index) * this.symbolSpacing;
      node.setPosition(node.position.x, yPosition, node.position.z);
      return node;
    });

    this.isInitialized = true;
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

  public getVisibleSymbolNodes(): Node[] {
    const nodes = this.symbolNodes.filter((n) => n?.isValid);
    if (!nodes.length) return [];

    const visibleCount = GameConfig.SYMBOL_PER_REEL;
    const half = (visibleCount - 1) / 2;
    const targetYs: number[] = [];
    for (let row = 0; row < visibleCount; row++) {
      targetYs.push((half - row) * this.symbolSpacing);
    }

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
      picked.push(remaining.splice(bestIdx, 1)[0]);
    });

    return picked.sort((a, b) => b.position.y - a.position.y);
  }

  public getVisibleSymbols(): string[] {
    const visibleNodes = this.getVisibleSymbolNodes();
    if (!visibleNodes.length) return [];
    return visibleNodes.map((node) => {
      const name = node.name;
      if (!name.startsWith(ReelContainer.SYMBOL_NAME_PREFIX)) return "";
      return name.slice(ReelContainer.SYMBOL_NAME_PREFIX.length);
    });
  }

  public getSymbolNodes(): Node[] {
    return this.symbolNodes;
  }

  public reset(): void {
    this.isInitialized = false;
    this.symbolNodes.forEach((node) => {
      if (node?.isValid) node.destroy();
    });
    this.symbolNodes = [];
  }

  public setVisibleSymbols(symbols: string[]): void {
    if (!this.symbolNodes.length || symbols.length === 0) return;
    const visibleNodes = this.getVisibleSymbolNodes();
    symbols.forEach((symbolId, index) => {
      const node = visibleNodes[index];
      if (node?.isValid && index < visibleNodes.length) {
        node.name = `${ReelContainer.SYMBOL_NAME_PREFIX}${symbolId}`;
        this.loadSpriteFrame(node, symbolId);
      }
    });
  }
}
