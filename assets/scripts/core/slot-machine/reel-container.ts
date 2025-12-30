import {
  _decorator,
  Component,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
} from "cc";
import { BundleName } from "../assets/asset-bundle-manager";
import { GameConfig } from "../../data/config/game-config";
import { SymbolData } from "../../data/models/symbol-data";
import { SpriteFrameCache } from "../../utils/helpers/sprite-frame-cache";
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
  private containers: SymbolContainer[] = [];
  private _pool: Node[] = [];

  // ==========================================
  // Symbol Container Creation
  // ==========================================

  private getFromPool(symbolId: string): Node {
    let node: Node;
    if (this._pool.length > 0) {
      node = this._pool.pop()!;
      node.name = `Symbol_${symbolId}`;
    } else {
      node = new Node(`Symbol_${symbolId}`);
      node.layer = this.node.layer;
      node
        .addComponent(UITransform)
        .setContentSize(GameConfig.SYMBOL_SIZE, GameConfig.SYMBOL_SIZE);
      const sprite = node.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.trim = false;
    }
    node.active = true;
    return node;
  }

  public async createSymbolContainer(
    symbolId: string
  ): Promise<SymbolContainer | null> {
    const node = this.getFromPool(symbolId);
    const sprite = node.getComponent(Sprite)!;

    const symbolData = SymbolData.getSymbol(symbolId);
    const spritePath = symbolData?.spritePath || symbolId;

    const cache = SpriteFrameCache.getInstance();
    const normalSF = cache.getSpriteFrame(BundleName.SYMBOLS, spritePath);
    const blurSF = cache.getSpriteFrame(BundleName.SYMBOLS, `${spritePath}_2`);

    sprite.spriteFrame = normalSF;

    const container: SymbolContainer = {
      node,
      sprite,
      symbolId,
      normalSpriteFrame: normalSF,
      blurSpriteFrame: blurSF || normalSF,
      isBlurred: false,
    };

    this.containers.push(container);
    return container;
  }

  // ==========================================
  // Sprite Loading
  // ==========================================

  public async loadSymbolSprite(
    symbolId: string,
    isBlur: boolean = false
  ): Promise<SpriteFrame | null> {
    const frameName = isBlur ? `${symbolId}_2` : symbolId;

    const cache = SpriteFrameCache.getInstance();
    let sf = cache.getSpriteFrame(BundleName.SYMBOLS, frameName);

    if (!sf && isBlur) {
      sf = cache.getSpriteFrame(BundleName.SYMBOLS, symbolId);
    }

    return sf;
  }
  // ==========================================
  // Symbol Container Management
  // ==========================================

  public updateSymbolContainer(
    container: SymbolContainer,
    newId: string
  ): void {
    const cache = SpriteFrameCache.getInstance();
    container.symbolId = newId;

    const symbolData = SymbolData.getSymbol(newId);
    const spritePath = symbolData?.spritePath || newId;

    container.normalSpriteFrame = cache.getSpriteFrame(
      BundleName.SYMBOLS,
      spritePath
    );
    container.blurSpriteFrame =
      cache.getSpriteFrame(BundleName.SYMBOLS, `${spritePath}_2`) ||
      container.normalSpriteFrame;

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
        container.node.active = false;
        container.node.removeFromParent();
        this._pool.push(container.node);
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
