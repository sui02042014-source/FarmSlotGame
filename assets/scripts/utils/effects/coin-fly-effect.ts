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
import { CoinPool } from "../pooling/coin-pool";

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

export class CoinFlyEffect {
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

    // Get shared coin pool instance
    const coinPool = CoinPool.getInstance();

    // Initialize if not done yet
    const poolStats = coinPool.getStats();
    if (poolStats.totalCreated === 0) {
      coinPool.quickInitialize(coinSize);
    }

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
      const coin = coinPool.get();
      if (!coin) continue;

      coin.setParent(parent);
      const sprite = coin.getComponent(Sprite)!;
      sprite.spriteFrame = sf;
      sprite.color = Color.WHITE;

      coin.setPosition(startPos);
      coin.setScale(Vec3.ZERO);

      const angle = math.randomRange(0, Math.PI * 2);
      const dist = math.randomRange(scatterRadius * 0.4, scatterRadius);
      const scatterPos = new Vec3(
        startPos.x + Math.cos(angle) * dist,
        startPos.y + Math.sin(angle) * dist,
        0
      );

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
            coinPool.put(coin);
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
    CoinPool.getInstance().clear();
  }
}
