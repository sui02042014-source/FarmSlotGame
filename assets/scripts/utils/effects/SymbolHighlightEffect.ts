import {
  Color,
  Node,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UITransform,
  Vec3,
  _decorator,
} from "cc";
import { SpriteFrameCache } from "../helpers/SpriteFrameCache";
import { BundleName } from "../../core/asset-manager/AssetBundleManager";

const { ccclass } = _decorator;

export type SymbolHighlightOptions = {
  targetNode: Node;
  duration?: number;
  loop?: boolean;
  brightness?: number;
  onComplete?: () => void;
  onFrameChange?: (frameIndex: number) => void;
};

class RoundAnimationController {
  private static roundFrames: SpriteFrame[] = [];
  private static isLoaded = false;

  public static async loadFrames(): Promise<void> {
    if (this.isLoaded) return;

    try {
      const cache = SpriteFrameCache.getInstance();
      const frameCount = 90;

      for (let i = 0; i < frameCount; i++) {
        const frameNumber = i.toString().padStart(3, "0");
        const spritePath = `ui/round/round_${frameNumber}/spriteFrame`;

        const sf = await cache.getSpriteFrameFromBundle(
          BundleName.GAME,
          spritePath
        );

        if (sf) {
          this.roundFrames.push(sf);
        } else {
          console.warn(
            `[RoundAnimationController] Failed to load frame: ${spritePath}`
          );
        }
      }

      this.isLoaded = true;
      console.log(
        `[RoundAnimationController] Loaded ${this.roundFrames.length} animation frames`
      );
    } catch (error) {
      console.error("[RoundAnimationController] Error loading frames:", error);
    }
  }

  public static getFrameCount(): number {
    return this.roundFrames.length;
  }

  public static getFrame(index: number): SpriteFrame | null {
    if (index < 0 || index >= this.roundFrames.length) return null;
    return this.roundFrames[index];
  }

  public static getAllFrames(): SpriteFrame[] {
    return [...this.roundFrames];
  }

  public static clearCache(): void {
    this.roundFrames = [];
    this.isLoaded = false;
  }
}

class HighlightPool {
  private pool: Node[] = [];
  private active: Set<Node> = new Set();
  private readonly maxPoolSize: number = 20;

  public get(parent: Node, size: number): Node {
    let highlightNode: Node;
    if (this.pool.length > 0) {
      highlightNode = this.pool.pop()!;
      const uiTransform = highlightNode.getComponent(UITransform);
      if (uiTransform) {
        uiTransform.setContentSize(size, size);
      }
    } else {
      highlightNode = new Node("SymbolHighlight");
      highlightNode.addComponent(UITransform).setContentSize(size, size);
      const sprite = highlightNode.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.trim = true;
    }

    highlightNode.layer = parent.layer;
    highlightNode.setParent(parent);
    highlightNode.active = true;
    highlightNode.setPosition(Vec3.ZERO);
    highlightNode.setScale(Vec3.ONE);

    this.active.add(highlightNode);
    return highlightNode;
  }

  public release(highlightNode: Node): void {
    if (!highlightNode?.isValid) return;

    Tween.stopAllByTarget(highlightNode);
    highlightNode.active = false;
    highlightNode.removeFromParent();
    this.active.delete(highlightNode);

    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(highlightNode);
    } else {
      highlightNode.destroy();
    }
  }

  public clear(): void {
    this.active.forEach((node) => node.isValid && node.destroy());
    this.pool.forEach((node) => node.isValid && node.destroy());
    this.active.clear();
    this.pool = [];
  }
}

@ccclass("SymbolHighlightEffect")
export class SymbolHighlightEffect {
  private static highlightPool: HighlightPool = new HighlightPool();
  private static isInitialized = false;

  public static async initialize(): Promise<void> {
    if (this.isInitialized) return;

    await RoundAnimationController.loadFrames();
    this.isInitialized = true;
  }

  public static async play(opts: SymbolHighlightOptions): Promise<void> {
    await this.initialize();

    const {
      targetNode,
      duration = 1.0,
      loop = true,
      brightness = 1,
      onComplete,
      onFrameChange,
    } = opts;

    if (!targetNode?.isValid) return;

    const uiTransform = targetNode.getComponent(UITransform);
    if (!uiTransform) return;

    // Set size to 110% of symbol size (no scaling animation)
    const symbolSize = Math.max(
      uiTransform.contentSize.width,
      uiTransform.contentSize.height
    );
    const highlightSize = symbolSize * 1.1;

    const highlightNode = this.highlightPool.get(targetNode, highlightSize);
    const sprite = highlightNode.getComponent(Sprite)!;

    sprite.color = new Color(
      255 * brightness,
      255 * brightness,
      255 * brightness,
      255
    );

    // No scale animation - keep at 1:1 scale
    highlightNode.setScale(Vec3.ONE);

    const frames = RoundAnimationController.getAllFrames();
    if (frames.length === 0) {
      console.error("[SymbolHighlightEffect] No animation frames available");
      this.highlightPool.release(highlightNode);
      return;
    }

    // Frame animation only - no movement or scaling
    const frameDuration = duration / frames.length;
    let currentFrame = 0;
    let isPlaying = true;

    const playFrame = () => {
      if (!isPlaying || !highlightNode.isValid) return;

      const frame = frames[currentFrame];
      if (frame) {
        sprite.spriteFrame = frame;
        onFrameChange?.(currentFrame);
      }

      currentFrame++;

      if (currentFrame >= frames.length) {
        if (loop) {
          currentFrame = 0;
        } else {
          isPlaying = false;
          this.highlightPool.release(highlightNode);
          onComplete?.();
          return;
        }
      }

      tween(highlightNode).delay(frameDuration).call(playFrame).start();
    };

    playFrame();

    (highlightNode as any)._stopHighlight = () => {
      isPlaying = false;
      this.highlightPool.release(highlightNode);
    };
  }

  public static stop(targetNode: Node): void {
    if (!targetNode?.isValid) return;

    const highlightNode = targetNode.children.find(
      (child) => child.name === "SymbolHighlight" && child.active
    );

    if (highlightNode && (highlightNode as any)._stopHighlight) {
      (highlightNode as any)._stopHighlight();
    }
  }

  public static stopAll(): void {
    this.highlightPool.clear();
  }

  public static getFrameCount(): number {
    return RoundAnimationController.getFrameCount();
  }

  public static isReady(): boolean {
    return this.isInitialized && RoundAnimationController.getFrameCount() > 0;
  }
}
