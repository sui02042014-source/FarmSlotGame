import { Node, Sprite, UITransform, Vec3, tween, math, Size, Tween } from "cc";
import { SpriteFrameCache } from "./SpriteFrameCache";

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
  spriteFramePath?: string;
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
      coin.setParent(parent);
    } else {
      coin = new Node("Coin");
      const ui = coin.addComponent(UITransform);
      ui.setContentSize(new Size(coinSize, coinSize));
      const sprite = coin.addComponent(Sprite);
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    }
    this.active.add(coin);
    return coin;
  }

  public release(coin: Node): void {
    if (!coin?.isValid) return;
    Tween.stopAllByTarget(coin);
    coin.setParent(null);
    coin.setPosition(Vec3.ZERO);
    coin.setScale(Vec3.ONE);
    this.active.delete(coin);
    if (this.pool.length < this.maxPoolSize) {
      this.pool.push(coin);
    } else {
      coin.destroy();
    }
  }

  public releaseAll(): void {
    this.active.forEach((coin) => {
      if (coin?.isValid) {
        Tween.stopAllByTarget(coin);
        coin.setParent(null);
        this.pool.push(coin);
      }
    });
    this.active.clear();
  }

  public clear(): void {
    this.releaseAll();
    this.pool.forEach((coin) => {
      if (coin?.isValid) coin.destroy();
    });
    this.pool = [];
  }
}

export class CoinFlyEffect {
  private static coinPool: CoinPool = new CoinPool();

  private static getWorldPos(node: Node): Vec3 {
    const ui = node.getComponent(UITransform);
    if (ui) return ui.convertToWorldSpaceAR(Vec3.ZERO);
    return node.worldPosition.clone();
  }

  private static worldToLocal(parent: Node, world: Vec3): Vec3 {
    const ui = parent.getComponent(UITransform);
    if (ui) return ui.convertToNodeSpaceAR(world);
    return parent.inverseTransformPoint(new Vec3(), world);
  }

  public static async play(opts: CoinFlyEffectOptions): Promise<void> {
    const {
      parent,
      fromNode,
      toNode,
      coinCount = 32,
      scatterRadius = 180,
      scatterDuration = 0.22,
      flyDuration = 0.6,
      stagger = 0.02,
      coinSize = 44,
      coinScale = 0.7,
      spriteFramePath = "win/coin_icon/spriteFrame",
      onAllArrive,
    } = opts;

    if (!parent?.isValid || !fromNode?.isValid || !toNode?.isValid) return;

    const cache = SpriteFrameCache.getInstance();
    const sf = await cache.getSpriteFrame(spriteFramePath);
    if (!sf || !parent?.isValid || !fromNode?.isValid || !toNode?.isValid)
      return;

    const fromWorld = this.getWorldPos(fromNode);
    const toWorld = this.getWorldPos(toNode);
    const start = this.worldToLocal(parent, fromWorld);
    const target = this.worldToLocal(parent, toWorld);

    let arrived = 0;
    const total = Math.max(0, coinCount | 0);
    if (!total) return;

    const coins: Node[] = [];
    for (let i = 0; i < total; i++) {
      if (!parent?.isValid) break;
      const coin = this.coinPool.get(parent, coinSize);
      const sprite = coin.getComponent(Sprite);
      if (sprite) {
        sprite.spriteFrame = sf;
      }
      coins.push(coin);
    }

    for (let i = 0; i < coins.length; i++) {
      const coin = coins[i];
      if (!coin?.isValid || !parent?.isValid) continue;

      coin.setPosition(start);
      coin.setScale(new Vec3(coinScale, coinScale, 1));
      const maxSiblingIndex =
        parent.children.length > 0
          ? Math.max(...parent.children.map((child) => child.getSiblingIndex()))
          : -1;
      coin.setSiblingIndex(maxSiblingIndex + 1);

      const angle = math.randomRange(0, Math.PI * 2);
      const dist = math.randomRange(scatterRadius * 0.35, scatterRadius);
      const scatter = new Vec3(
        start.x + Math.cos(angle) * dist,
        start.y + Math.sin(angle) * dist,
        0
      );

      const midScale = coinScale * math.randomRange(0.9, 1.15);
      const endScale = coinScale * math.randomRange(0.45, 0.75);
      const delay = i * stagger;

      const liftUp = new Vec3(start.x, start.y + 100, 0);
      const liftDuration = scatterDuration * 0.3;

      tween(coin)
        .delay(delay)
        .to(
          liftDuration,
          { position: liftUp, scale: new Vec3(midScale, midScale, 1) },
          { easing: "quadOut" }
        )
        .to(
          scatterDuration - liftDuration,
          { position: scatter, scale: new Vec3(midScale, midScale, 1) },
          { easing: "quadOut" }
        )
        .to(
          flyDuration,
          { position: target, scale: new Vec3(endScale, endScale, 1) },
          { easing: "quadIn" }
        )
        .call(() => {
          this.coinPool.release(coin);
          arrived++;
          if (arrived >= total) {
            if (onAllArrive) onAllArrive();
          }
        })
        .start();
    }
  }

  public static clearPool(): void {
    this.coinPool.clear();
  }
}
