import { SpriteFrame, SpriteAtlas } from "cc";
import { AssetBundleManager } from "../../core/asset-manager/AssetBundleManager";

export class SpriteFrameCache {
  private static _instance: SpriteFrameCache | null = null;
  private _cache = new Map<string, SpriteFrame>();

  public static getInstance(): SpriteFrameCache {
    if (!this._instance) this._instance = new SpriteFrameCache();
    return this._instance;
  }

  private makeKey(bundle: string, path: string): string {
    return `${bundle}/${path}`;
  }

  public cacheAtlas(bundleName: string, atlas: SpriteAtlas): void {
    const frames = atlas.getSpriteFrames();
    if (!frames || frames.length === 0) {
      return;
    }
    frames.forEach((sf) => {
      sf.packable = true;
      this._cache.set(this.makeKey(bundleName, sf.name), sf);
    });
  }

  public setStaticCache(bundle: string, path: string, sf: SpriteFrame): void {
    sf.packable = true; // Enable batching for individual sprites
    this._cache.set(this.makeKey(bundle, path), sf);
  }

  public getSpriteFrame(bundle: string, path: string): SpriteFrame | null {
    const key = this.makeKey(bundle, path);
    const sf = this._cache.get(key);
    return sf || null;
  }

  public async getSpriteFrameFromBundle(
    bundleName: string,
    path: string
  ): Promise<SpriteFrame | null> {
    const key = this.makeKey(bundleName, path);

    // Check cache first
    const cached = this._cache.get(key);
    if (cached) return cached;

    // Load from bundle if not cached
    const bundleManager = AssetBundleManager.getInstance();
    const sf = await bundleManager.load(bundleName, path, SpriteFrame);

    if (sf) {
      this._cache.set(key, sf);
    }

    return sf;
  }

  public clear(): void {
    this._cache.clear();
  }
}
