import {
  Node,
  Sprite,
  SpriteFrame,
  UITransform,
  Vec3,
  tween,
  resources,
  math,
  Size,
} from "cc";

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

export class CoinFlyEffect {
  private static cached: Map<string, SpriteFrame> = new Map();
  private static loading: Map<string, Promise<SpriteFrame | null>> = new Map();

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

  private static async loadSpriteFrame(
    path: string
  ): Promise<SpriteFrame | null> {
    const cached = this.cached.get(path);
    if (cached) return cached;

    const existing = this.loading.get(path);
    if (existing) return existing;

    const loader = new Promise<SpriteFrame | null>((resolve) => {
      resources.load(path, SpriteFrame, (err, sf) => {
        if (err || !sf) {
          resolve(null);
          return;
        }
        resolve(sf);
      });
    });

    this.loading.set(path, loader);
    loader.then(
      (sf) => {
        this.loading.delete(path);
        if (sf) this.cached.set(path, sf);
      },
      () => this.loading.delete(path)
    );

    return loader;
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

    const sf = await this.loadSpriteFrame(spriteFramePath);
    if (!sf || !parent?.isValid || !fromNode?.isValid || !toNode?.isValid)
      return;

    const fromWorld = this.getWorldPos(fromNode);
    const toWorld = this.getWorldPos(toNode);
    const start = this.worldToLocal(parent, fromWorld);
    const target = this.worldToLocal(parent, toWorld);

    let arrived = 0;
    const total = Math.max(0, coinCount | 0);
    if (!total) return;

    for (let i = 0; i < total; i++) {
      if (!parent?.isValid) break;

      const coin = new Node(`Coin_${i}`);
      const ui = coin.addComponent(UITransform);
      ui.setContentSize(new Size(coinSize, coinSize));

      const sprite = coin.addComponent(Sprite);
      sprite.spriteFrame = sf;
      sprite.sizeMode = Sprite.SizeMode.CUSTOM;

      coin.setParent(parent);
      coin.setPosition(start);
      coin.setScale(new Vec3(coinScale, coinScale, 1));
      const maxSiblingIndex =
        parent.children.length > 0
          ? Math.max(
              ...parent.children.map((child, idx) => child.getSiblingIndex())
            )
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
          if (coin?.isValid) coin.destroy();
          arrived++;
          if (arrived >= total) {
            if (onAllArrive) onAllArrive();
          }
        })
        .start();
    }
  }
}
