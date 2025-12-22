import { Node, Sprite, SpriteFrame } from "cc";

export class BatchingOptimizer {
  public static optimizeSpriteGrouping(parent: Node): void {
    if (!parent?.isValid) return;

    const spritesByFrame = new Map<SpriteFrame, Sprite[]>();

    const collectSprites = (node: Node): void => {
      const sprite = node.getComponent(Sprite);
      if (sprite?.spriteFrame) {
        const frame = sprite.spriteFrame;
        if (!spritesByFrame.has(frame)) {
          spritesByFrame.set(frame, []);
        }
        spritesByFrame.get(frame)!.push(sprite);
      }

      node.children.forEach((child) => {
        if (child?.isValid) {
          collectSprites(child);
        }
      });
    };

    collectSprites(parent);

    if (spritesByFrame.size > 0) {
      const totalSprites = Array.from(spritesByFrame.values()).reduce(
        (sum, sprites) => sum + sprites.length,
        0
      );
      const uniqueTextures = spritesByFrame.size;

      const avgSpritesPerTexture = totalSprites / uniqueTextures;

      if (avgSpritesPerTexture < 2) {
        console.warn(
          `[BatchingOptimizer] Low batching efficiency: ${totalSprites} sprites across ${uniqueTextures} textures. ` +
            `Consider using SpriteAtlas to combine textures.`
        );
      }
    }
  }

  public static getBatchingStats(parent: Node): {
    totalSprites: number;
    uniqueTextures: number;
    avgSpritesPerTexture: number;
  } {
    const spritesByFrame = new Map<SpriteFrame, Sprite[]>();

    const collectSprites = (node: Node): void => {
      const sprite = node.getComponent(Sprite);
      if (sprite?.spriteFrame) {
        const frame = sprite.spriteFrame;
        if (!spritesByFrame.has(frame)) {
          spritesByFrame.set(frame, []);
        }
        spritesByFrame.get(frame)!.push(sprite);
      }

      node.children.forEach((child) => {
        if (child?.isValid) {
          collectSprites(child);
        }
      });
    };

    collectSprites(parent);

    const totalSprites = Array.from(spritesByFrame.values()).reduce(
      (sum, sprites) => sum + sprites.length,
      0
    );
    const uniqueTextures = spritesByFrame.size;
    const avgSpritesPerTexture =
      uniqueTextures > 0 ? totalSprites / uniqueTextures : 0;

    return {
      totalSprites,
      uniqueTextures,
      avgSpritesPerTexture,
    };
  }
}
