import {
  _decorator,
  Component,
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  sp,
} from "cc";
import { AssetBundleManager, BundleName } from "../assets/asset-bundle-manager";
import { GameConfig } from "../../data/config/game-config";
import { SymbolData } from "../../data/models/symbol-data";
import { SpriteFrameCache } from "../../utils/helpers/sprite-frame-cache";
import { Logger } from "../../utils/helpers/logger";
const { ccclass } = _decorator;

const logger = Logger.create("ReelContainer");

export interface SymbolContainer {
  node: Node;
  sprite: Sprite;
  spine?: sp.Skeleton;
  symbolId: string;
  normalSpriteFrame: SpriteFrame | null;
  blurSpriteFrame: SpriteFrame | null;
}

@ccclass("ReelContainer")
export class ReelContainer extends Component {
  private containers: SymbolContainer[] = [];
  private _pool: Node[] = [];
  private _useBlur: boolean = false;

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
    try {
      const node = this.getFromPool(symbolId);
      const sprite = node.getComponent(Sprite)!;

      const symbolData = SymbolData.getSymbol(symbolId);
      const spritePath = symbolData?.spritePath || symbolId;

      const cache = SpriteFrameCache.getInstance();
      const normalSF = cache.getSpriteFrame(BundleName.SYMBOLS, spritePath);
      const blurSF = cache.getSpriteFrame(
        BundleName.SYMBOLS,
        `${spritePath}_2`
      );

      if (!normalSF) {
        logger.error(`Failed to load sprite frame: ${spritePath}`);
        // Return node to pool
        node.active = false;
        this._pool.push(node);
        return null;
      }

      sprite.spriteFrame = this._useBlur ? blurSF || normalSF : normalSF;

      const container: SymbolContainer = {
        node,
        sprite,
        symbolId,
        normalSpriteFrame: normalSF,
        blurSpriteFrame: blurSF,
      };

      // Load spine animation asynchronously (non-blocking)
      if (symbolData?.animationPath) {
        this.initSpineForContainer(container, symbolData.animationPath).catch(
          (err) => {
            // Animation is optional, log but don't fail
            logger.warn(`Spine animation load failed for ${symbolId}:`, err);
          }
        );
      }

      return container;
    } catch (error) {
      logger.error(`Failed to create symbol container for ${symbolId}:`, error);
      return null;
    }
  }

  private async initSpineForContainer(
    container: SymbolContainer,
    path: string
  ): Promise<void> {
    try {
      const assetManager = AssetBundleManager.getInstance();
      const skeletonData = await assetManager.load(
        BundleName.SYMBOLS,
        path,
        sp.SkeletonData
      );

      if (skeletonData && container.node.isValid) {
        let spine = container.node.getComponent(sp.Skeleton);
        if (!spine) {
          spine = container.node.addComponent(sp.Skeleton);
        }
        spine.skeletonData = skeletonData;
        spine.premultipliedAlpha = true;
        spine.node.active = false;
        container.spine = spine;
      }
    } catch (error) {
      logger.warn(`Failed to load spine animation: ${path}`, error);
      // Continue without animation - sprite will be used instead
    }
  }

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
    container.blurSpriteFrame = cache.getSpriteFrame(
      BundleName.SYMBOLS,
      `${spritePath}_2`
    );

    container.sprite.spriteFrame = this._useBlur
      ? container.blurSpriteFrame || container.normalSpriteFrame
      : container.normalSpriteFrame;

    if (container.spine) {
      container.spine.node.active = false;
    }

    if (symbolData?.animationPath) {
      this.initSpineForContainer(container, symbolData.animationPath);
    }
  }

  public setUseBlur(useBlur: boolean): void {
    this._useBlur = useBlur;
    this.containers.forEach((container) => {
      const sf = useBlur
        ? container.blurSpriteFrame || container.normalSpriteFrame
        : container.normalSpriteFrame;
      if (container.sprite.spriteFrame !== sf) {
        container.sprite.spriteFrame = sf;
      }
    });
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
