import { SpriteFrame, SpriteAtlas } from "cc";
import { AssetBundleManager } from "../../core/assets/asset-bundle-manager";

export class SpriteFrameCache {
  private static instance: SpriteFrameCache | null = null;
  private cache = new Map<string, SpriteFrame>();
  private bundleManager = AssetBundleManager.getInstance();

  public static getInstance(): SpriteFrameCache {
    if (!this.instance) this.instance = new SpriteFrameCache();
    return this.instance;
  }

  private makeKey(bundle: string, path: string): string {
    return `${bundle}/${path}`;
  }

  public cacheAtlas(bundleName: string, atlas: SpriteAtlas): void {
    const frames = atlas.getSpriteFrames();
    if (!frames || frames.length === 0) return;

    frames.forEach((sf) => {
      if (!sf) return;
      sf.packable = true;
      this.cache.set(this.makeKey(bundleName, sf.name), sf);
    });
  }

  public setStaticCache(bundle: string, path: string, sf: SpriteFrame): void {
    sf.packable = true;
    const key = this.makeKey(bundle, path);
    this.cache.set(key, sf);
  }

  public getSpriteFrame(bundle: string, path: string): SpriteFrame | null {
    const key = this.makeKey(bundle, path);
    return this.cache.get(key) || null;
  }

  public async getSpriteFrameFromBundle(
    bundleName: string,
    path: string
  ): Promise<SpriteFrame | null> {
    const key = this.makeKey(bundleName, path);

    const cached = this.cache.get(key);
    if (cached) return cached;

    const sf = await this.bundleManager.load(bundleName, path, SpriteFrame);

    if (sf) {
      this.cache.set(key, sf);
    }

    return sf;
  }

  // ==========================================
  // Cache Clearing
  // ==========================================

  public clear(): void {
    this.cache.clear();
  }

  public clearBundle(bundleName: string): void {
    const prefix = `${bundleName}/`;

    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  // ==========================================
  // Statistics
  // ==========================================

  public getStats(): { cachedFrames: number; bundles: string[] } {
    const bundleSet = new Set<string>();

    for (const key of this.cache.keys()) {
      const bundle = key.split("/")[0];
      bundleSet.add(bundle);
    }

    return {
      cachedFrames: this.cache.size,
      bundles: Array.from(bundleSet),
    };
  }
}
