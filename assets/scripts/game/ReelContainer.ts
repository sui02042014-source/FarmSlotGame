import {
  _decorator,
  Component,
  Node,
  Sprite,
  UITransform,
  SpriteFrame,
} from "cc";
import { GameConfig } from "../data/GameConfig";
import { SymbolData } from "../data/SymbolData";
import { SpriteFrameCache } from "../utils/SpriteFrameCache";
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
      if (!isBlur) {
        console.warn(`Failed to load sprite for ${symbolId}:`, error);
      }
      return null;
    }
  }

  public async updateSymbolContainer(
    container: SymbolContainer,
    newSymbolId: string
  ): Promise<void> {
    if (container.symbolId === newSymbolId) return;

    container.symbolId = newSymbolId;
    const normalSprite = await this.loadSymbolSprite(newSymbolId);
    const blurSprite = await this.loadSymbolSprite(newSymbolId, true);

    if (normalSprite) {
      container.normalSpriteFrame = normalSprite;
    }
    if (blurSprite) {
      container.blurSpriteFrame = blurSprite;
    } else if (normalSprite) {
      container.blurSpriteFrame = normalSprite;
    }

    if (!container.isBlurred && container.normalSpriteFrame) {
      container.sprite.spriteFrame = container.normalSpriteFrame;
    } else if (container.isBlurred && container.blurSpriteFrame) {
      container.sprite.spriteFrame = container.blurSpriteFrame;
    }
  }

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
