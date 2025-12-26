import {
  _decorator,
  Component,
  Node,
  Sprite,
  UITransform,
  SpriteFrame,
} from "cc";
import { GameConfig } from "../../data/config/GameConfig";
import { SymbolData } from "../../data/models/SymbolData";
import { SpriteFrameCache } from "../../utils/helpers/SpriteFrameCache";
const { ccclass } = _decorator;

export interface SymbolContainer {
  node: Node;
  sprite: Sprite;
  symbolId: string;
  normalSpriteFrame: SpriteFrame | null;
  blurSpriteFrame: SpriteFrame | null;
  isBlurred: boolean;
}

@ccclass("ReelContainer")
export class ReelContainer extends Component {
  private readonly spriteFrameCache = SpriteFrameCache.getInstance();
  private containers: SymbolContainer[] = [];

  // ==========================================
  // Symbol Container Creation
  // ==========================================

  public async createSymbolContainer(
    symbolId: string,
    symbolSize?: number
  ): Promise<SymbolContainer | null> {
    const size = symbolSize || GameConfig.SYMBOL_SIZE;
    const node = new Node(`Symbol_${symbolId}_${Date.now()}`);
    const uiTransform = node.addComponent(UITransform);
    uiTransform.setContentSize(size, size);
    uiTransform.setAnchorPoint(0.5, 0.5);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const normalSpriteFrame = await this.loadSymbolSprite(symbolId);
    if (normalSpriteFrame) {
      sprite.spriteFrame = normalSpriteFrame;
    }

    const blurSpriteFrame = await this.loadSymbolSprite(symbolId, true);

    return {
      node,
      sprite,
      symbolId,
      normalSpriteFrame,
      blurSpriteFrame: blurSpriteFrame || normalSpriteFrame,
      isBlurred: false,
    };
  }

  // ==========================================
  // Sprite Loading
  // ==========================================

  public async loadSymbolSprite(
    symbolId: string,
    isBlur: boolean = false
  ): Promise<SpriteFrame | null> {
    const symbolData = SymbolData.getSymbol(symbolId);
    if (!symbolData) return null;

    try {
      const path = isBlur
        ? `${symbolData.spritePath}_2/spriteFrame`
        : `${symbolData.spritePath}/spriteFrame`;

      const spriteFrame = await this.spriteFrameCache.getSpriteFrameFromBundle(
        "symbols",
        path
      );

      if (!spriteFrame && isBlur) {
        return null;
      }

      return spriteFrame;
    } catch (error) {
      return null;
    }
  }

  // ==========================================
  // Symbol Container Management
  // ==========================================

  public async updateSymbolContainer(
    container: SymbolContainer,
    newSymbolId: string
  ): Promise<void> {
    if (container.symbolId === newSymbolId) return;

    container.symbolId = newSymbolId;
    const normalSprite = await this.loadSymbolSprite(newSymbolId);
    const blurSprite = await this.loadSymbolSprite(newSymbolId, true);

    if (normalSprite) container.normalSpriteFrame = normalSprite;
    if (blurSprite) container.blurSpriteFrame = blurSprite;
    else container.blurSpriteFrame = normalSprite;

    container.sprite.spriteFrame = container.isBlurred
      ? container.blurSpriteFrame
      : container.normalSpriteFrame;
  }

  // ==========================================
  // Container Access
  // ==========================================

  public getAllContainers(): SymbolContainer[] {
    return this.containers;
  }

  public addContainer(container: SymbolContainer): void {
    this.containers.push(container);
  }

  public clearContainers(): void {
    this.containers.forEach((container) => {
      if (container.node?.isValid) {
        container.node.destroy();
      }
    });
    this.containers = [];
  }

  public getSortedContainers(): SymbolContainer[] {
    return [...this.containers].sort(
      (a, b) => b.node.position.y - a.node.position.y
    );
  }
}
