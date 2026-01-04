import { Color, math, Node, Sprite, tween, UITransform, Vec3, view } from "cc";
import { BundleName } from "../../core/assets/asset-bundle-manager";
import { SpriteFrameCache } from "../helpers/sprite-frame-cache";
import { CoinPool } from "../pooling/coin-pool";

export type CoinRainEffectOptions = {
  parent: Node;
  coinSize?: number;
  coinScale?: number;
  spawnInterval?: number;
  fallDuration?: number;
  asBackground?: boolean;
};

export class CoinRainEffect {
  private static isRaining: boolean = false;
  private static rainTimer: any = null;

  public static async start(opts: CoinRainEffectOptions): Promise<void> {
    if (this.isRaining) return;
    this.isRaining = true;

    const {
      parent,
      coinSize = 80,
      coinScale = 1.2,
      spawnInterval = 0.02,
      fallDuration = 1.2,
      asBackground = false,
    } = opts;

    if (!parent?.isValid) return;

    const coinPool = CoinPool.getInstance();

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
    if (!sf) return;

    const parentUITrans = parent.getComponent(UITransform)!;
    const visibleSize = view.getVisibleSize();

    const topY = visibleSize.height / 2 + 100;
    const bottomY = -visibleSize.height / 2 - 200;
    const minX = -visibleSize.width / 2;
    const maxX = visibleSize.width / 2;

    const spawnCoin = () => {
      if (!this.isRaining || !parent.isValid) {
        this.stop();
        return;
      }

      const coin = coinPool.get();
      if (!coin) return;

      coin.setParent(parent);
      if (asBackground) {
        coin.setSiblingIndex(1);
      }

      const sprite = coin.getComponent(Sprite)!;
      sprite.spriteFrame = sf;
      sprite.color = Color.WHITE;

      const startX = math.randomRange(minX, maxX);
      coin.setPosition(startX, topY, 0);

      const scale = coinScale * math.randomRange(0.7, 1.3);
      coin.setScale(scale, scale, 1);
      coin.setRotationFromEuler(0, 0, math.randomRange(0, 360));

      const duration = fallDuration * math.randomRange(0.8, 1.2);
      const rotationSpeed =
        math.randomRange(180, 720) * (Math.random() > 0.5 ? 1 : -1);
      const endX = startX + math.randomRange(-200, 200);

      tween(coin)
        .parallel(
          tween(coin).to(
            duration,
            { position: new Vec3(endX, bottomY, 0) },
            { easing: "linear" }
          ),
          tween(coin).by(duration, { angle: rotationSpeed * duration })
        )
        .call(() => {
          coinPool.put(coin);
        })
        .start();
    };

    const loop = () => {
      if (!this.isRaining) return;
      spawnCoin();
      spawnCoin(); // Spawn two at once for more density
      this.rainTimer = setTimeout(loop, spawnInterval * 1000);
    };
    loop();
  }

  public static stop(): void {
    this.isRaining = false;
    if (this.rainTimer) {
      clearTimeout(this.rainTimer);
      this.rainTimer = null;
    }
  }

  public static clear(): void {
    this.stop();
    CoinPool.getInstance().clear();
  }
}
