import {
  _decorator,
  Component,
  Node,
  Sprite,
  SpriteAtlas,
  SpriteFrame,
  UITransform,
} from "cc";
import { GameConfig } from "../../data/config/GameConfig";
import { SymbolData } from "../../data/models/SymbolData";
import { SpriteFrameCache } from "../../utils/helpers/SpriteFrameCache";
import { BundleName } from "../asset-manager/AssetBundleManager";
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
  private _symbolAtlas: SpriteAtlas | null = null;

  // ==========================================
  // Symbol Container Creation
  // ==========================================

  public initAtlas(atlas: SpriteAtlas) {
    this._symbolAtlas = atlas;
  }

  public async createSymbolContainer(
    symbolId: string
  ): Promise<SymbolContainer | null> {
    const node = new Node(`Symbol_${symbolId}`);
    const ui = node.addComponent(UITransform);
    ui.setContentSize(GameConfig.SYMBOL_SIZE, GameConfig.SYMBOL_SIZE);

    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;

    const symbolData = SymbolData.getSymbol(symbolId);
    const spritePath = symbolData?.spritePath || symbolId;

    const normalSF = SpriteFrameCache.getInstance().getSpriteFrame(
      BundleName.SYMBOLS,
      spritePath
    );
    const blurSF = SpriteFrameCache.getInstance().getSpriteFrame(
      BundleName.SYMBOLS,
      `${spritePath}_blur`
    );

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
    const frameName = isBlur ? `${symbolId}_blur` : symbolId;

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
      cache.getSpriteFrame(BundleName.SYMBOLS, `${spritePath}_blur`) ||
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
