import {
  Color,
  math,
  Node,
  Size,
  Sprite,
  tween,
  Tween,
  UITransform,
  Vec3,
} from "cc";
import { SpriteFrameCache } from "../helpers/sprite-frame-cache";
import { BundleName } from "../../core/assets/asset-bundle-manager";

export type CoinFlyEffectOptions = {
  parent: Node;
  fromNode: Node;
  toNode: Node;
  coinCount?: number;
  scatterRadius?: number;
  scatterDuration?: number;
  flyDuration?: number;
  stagger?: number;
  coinSize?: number;
  coinScale?: number;
  onAllArrive?: () => void;
};

class CoinPool {
  private pool: Node[] = [];
  private active: Set<Node> = new Set();
  private readonly maxPoolSize: number = 50;

  public get(parent: Node, coinSize: number): Node {
    let coin: Node;
    if (this.pool.length > 0) {
      coin = this.pool.pop()!;
    } else {
      coin = new Node("Coin_FX");
      coin
        .addComponent(UITransform)
        .setContentSize(new Size(coinSize, coinSize));
      const sprite = coin.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
      sprite.trim = true;
    }

    coin.layer = parent.layer;
    coin.setParent(parent);
    coin.active = true;

    this.active.add(coin);
    return coin;
  }

  public release(coin: Node): void {
    if (!coin?.isValid) return;
    Tween.stopAllByTarget(coin);
    coin.active = false;
    coin.removeFromParent();
    this.active.delete(coin);

    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(coin);
    } else {
      coin.destroy();
    }
  }

  public clear(): void {
    this.active.forEach((c) => c.isValid && c.destroy());
    this.pool.forEach((c) => c.isValid && c.destroy());
    this.active.clear();
    this.pool = [];
  }
}

export class CoinFlyEffect {
  private static coinPool: CoinPool = new CoinPool();

  public static async play(opts: CoinFlyEffectOptions): Promise<void> {
    const {
      parent,
      fromNode,
      toNode,
      coinCount = 20,
      scatterRadius = 180,
      scatterDuration = 0.3,
      flyDuration = 0.65,
      stagger = 0.03,
      coinSize = 60,
      coinScale = 1.0,
      onAllArrive,
    } = opts;

    if (!parent?.isValid || !fromNode?.isValid || !toNode?.isValid) return;

    const cache = SpriteFrameCache.getInstance();
    const spritePath = "ui/win/coin_icon/spriteFrame";

    const sf = await cache.getSpriteFrameFromBundle(
      BundleName.GAME,
      spritePath
    );

    if (!sf) {
      return;
    }

    const fromUITrans = fromNode.getComponent(UITransform)!;
    const toUITrans = toNode.getComponent(UITransform)!;
    const parentUITrans = parent.getComponent(UITransform)!;

    const fromWorldPos = fromUITrans.convertToWorldSpaceAR(Vec3.ZERO);
    const toWorldPos = toUITrans.convertToWorldSpaceAR(Vec3.ZERO);

    const startPos = parentUITrans.convertToNodeSpaceAR(fromWorldPos);
    const endPos = parentUITrans.convertToNodeSpaceAR(toWorldPos);

    const promises: Promise<void>[] = [];

    for (let i = 0; i < coinCount; i++) {
      const coin = this.coinPool.get(parent, coinSize);
      // ... existing code ...
      const delay = i * stagger;

      const p = new Promise<void>((resolve) => {
        tween(coin)
          .delay(delay)
          .to(
            scatterDuration,
            {
              position: scatterPos,
              scale: new Vec3(coinScale, coinScale, 1),
            },
            { easing: "backOut" }
          )
          .to(
            flyDuration,
            {
              position: endPos,
              scale: new Vec3(coinScale * 0.5, coinScale * 0.5, 1),
            },
            { easing: "quartIn" }
          )
          .call(() => {
            this.coinPool.release(coin);
            resolve();
          })
          .start();
      });
      promises.push(p);
    }

    await Promise.all(promises);
    if (onAllArrive) onAllArrive();
  }

  public static clearPool(): void {
    this.coinPool.clear();
  }
}
