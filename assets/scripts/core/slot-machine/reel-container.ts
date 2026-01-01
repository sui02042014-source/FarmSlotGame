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

const CONTAINER_CONSTANTS = {
  BLUR_SUFFIX: "_2",
} as const;

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

  private spriteFrameCache!: SpriteFrameCache;
  private assetBundleManager!: AssetBundleManager;

  protected onLoad(): void {
    this.spriteFrameCache = SpriteFrameCache.getInstance();
    this.assetBundleManager = AssetBundleManager.getInstance();
  }

  private loadSpriteFrames(symbolId: string): {
    normal: SpriteFrame | null;
    blur: SpriteFrame | null;
  } {
    const symbolData = SymbolData.getSymbol(symbolId);
    const spritePath = symbolData?.spritePath || symbolId;

    const normal = this.spriteFrameCache.getSpriteFrame(
      BundleName.SYMBOLS,
      spritePath
    );
    const blur = this.spriteFrameCache.getSpriteFrame(
      BundleName.SYMBOLS,
      `${spritePath}${CONTAINER_CONSTANTS.BLUR_SUFFIX}`
    );

    return { normal, blur };
  }

  /**
   * Return a node to the pool for reuse
   */
  private returnToPool(node: Node | null): void {
    if (node?.isValid) {
      node.active = false;
      this._pool.push(node);
    }
  }

  /**
   * Get a node from pool or create new one
   */
  private getFromPool(symbolId: string): Node {
    let node: Node | undefined;

    // Try to get valid node from pool
    while (this._pool.length > 0) {
      const pooledNode = this._pool.pop()!;
      if (pooledNode?.isValid) {
        node = pooledNode;
        node.name = `Symbol_${symbolId}`;
        break;
      }
    }

    // Create new node if no valid node in pool
    if (!node) {
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

  /**
   * Initialize spine animation for a container
   */
  private async initSpineForContainer(
    container: SymbolContainer,
    path: string
  ): Promise<void> {
    try {
      const skeletonData = await this.assetBundleManager.load(
        BundleName.SYMBOLS,
        path,
        sp.SkeletonData
      );

      if (!skeletonData) {
        logger.warn(`Failed to load skeleton data at ${path}`);
        return;
      }

      if (!container.node.isValid) {
        logger.warn(`Container node is invalid for skeleton at ${path}`);
        return;
      }

      let spine = container.node.getComponent(sp.Skeleton);
      if (!spine) {
        spine = container.node.addComponent(sp.Skeleton);
      }

      spine.skeletonData = skeletonData;
      spine.premultipliedAlpha = true;
      spine.node.active = false;
      container.spine = spine;
    } catch (error) {
      logger.warn(`Failed to load spine animation at ${path}:`, error);
    }
  }

  /**
   * Apply blur state to a container's sprite
   */
  private applyBlurStateToContainer(container: SymbolContainer): void {
    if (!container || !container.sprite) {
      return;
    }
    container.sprite.spriteFrame = this._useBlur
      ? container.blurSpriteFrame || container.normalSpriteFrame
      : container.normalSpriteFrame;
  }

  // ==========================================
  // Public API - Container Creation
  // ==========================================

  public async createSymbolContainer(
    symbolId: string
  ): Promise<SymbolContainer | null> {
    let node: Node | null = null;
    try {
      node = this.getFromPool(symbolId);
      const sprite = node.getComponent(Sprite)!;

      const { normal: normalSF, blur: blurSF } =
        this.loadSpriteFrames(symbolId);

      if (!normalSF) {
        logger.warn(`Failed to load sprite frame for symbol: ${symbolId}`);
        this.returnToPool(node);
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

      // Initialize spine animation asynchronously if available
      const symbolData = SymbolData.getSymbol(symbolId);
      if (symbolData?.animationPath) {
        this.initSpineForContainer(container, symbolData.animationPath).catch(
          (error) => {
            logger.warn(
              `Spine init failed for ${symbolId}: ${symbolData.animationPath}`,
              error
            );
          }
        );
      }

      return container;
    } catch (error) {
      logger.error(`Error creating symbol container for ${symbolId}:`, error);
      this.returnToPool(node);
      return null;
    }
  }

  /**
   * Update an existing container with a new symbol
   */
  public updateSymbolContainer(
    container: SymbolContainer,
    newId: string
  ): void {
    if (!container || !container.node?.isValid) {
      logger.warn("Invalid container in updateSymbolContainer");
      return;
    }

    if (container.symbolId === newId) {
      this.applyBlurStateToContainer(container);
      return;
    }

    container.symbolId = newId;

    const { normal, blur } = this.loadSpriteFrames(newId);
    container.normalSpriteFrame = normal;
    container.blurSpriteFrame = blur;

    this.applyBlurStateToContainer(container);

    // Hide existing spine animation
    if (container.spine) {
      container.spine.node.active = false;
    }

    // Load new spine animation if available
    const symbolData = SymbolData.getSymbol(newId);
    if (symbolData?.animationPath) {
      this.initSpineForContainer(container, symbolData.animationPath).catch(
        (error) => {
          logger.warn(
            `Spine init failed for ${newId}: ${symbolData.animationPath}`,
            error
          );
        }
      );
    }
  }

  // ==========================================
  // Public API - Blur Effects
  // ==========================================

  public setUseBlur(useBlur: boolean): void {
    this._useBlur = useBlur;
    this.containers.forEach((container) => {
      this.applyBlurStateToContainer(container);
    });
  }

  // ==========================================
  // Public API - Container Management
  // ==========================================

  public getAllContainers(): SymbolContainer[] {
    return this.containers;
  }

  public addContainer(container: SymbolContainer): void {
    if (!container || !container.node?.isValid) {
      logger.warn("Attempted to add invalid container");
      return;
    }
    this.containers.push(container);
  }

  public getSortedContainers(): SymbolContainer[] {
    return this.containers
      .filter((c) => c?.node?.isValid)
      .sort((a, b) => b.node.position.y - a.node.position.y);
  }

  // ==========================================
  // Public API - Cleanup
  // ==========================================

  public clearContainers(): void {
    this.containers.forEach((container) => {
      if (container?.node?.isValid) {
        container.node.active = false;
        container.node.removeFromParent();
        this._pool.push(container.node);
      }
    });
    this.containers.length = 0;
  }

  public destroyAllContainers(): void {
    this.containers.forEach((container) => {
      if (container?.node?.isValid) {
        container.node.destroy();
      }
    });
    this.containers.length = 0;

    this._pool.forEach((node) => {
      if (node?.isValid) {
        node.destroy();
      }
    });
    this._pool.length = 0;
  }
}
