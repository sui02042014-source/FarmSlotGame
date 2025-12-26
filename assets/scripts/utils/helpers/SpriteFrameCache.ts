import { SpriteFrame, resources, AssetManager } from "cc";
import { AssetBundleManager } from "../../core/asset-manager/AssetBundleManager";

export class SpriteFrameCache {
  private static _instance: SpriteFrameCache | null = null;
  private _cache = new Map<string, SpriteFrame>();
  private _loadingPromises = new Map<string, Promise<SpriteFrame | null>>();

  private constructor() {}

  public static getInstance(): SpriteFrameCache {
    if (!this._instance) {
      this._instance = new SpriteFrameCache();
    }
    return this._instance;
  }

  public async getSpriteFrameFromBundle(
    bundleName: string,
    path: string
  ): Promise<SpriteFrame | null> {
    const key = `${bundleName}:${path}`;
    if (this._cache.has(key)) return this._cache.get(key)!;
    if (this._loadingPromises.has(key)) return this._loadingPromises.get(key)!;

    const promise = (async () => {
      try {
        const manager = AssetBundleManager.getInstance();
        const sf = await manager.load(bundleName, path, SpriteFrame);
        if (sf) this._cache.set(key, sf);
        return sf;
      } catch {
        return null;
      } finally {
        this._loadingPromises.delete(key);
      }
    })();

    this._loadingPromises.set(key, promise);
    return promise;
  }

  public async getSpriteFrame(path: string): Promise<SpriteFrame | null> {
    if (this._cache.has(path)) return this._cache.get(path)!;
    if (this._loadingPromises.has(path))
      return this._loadingPromises.get(path)!;

    const promise = new Promise<SpriteFrame | null>((resolve) => {
      resources.load(path, SpriteFrame, (err, sf) => {
        if (err || !sf) {
          resolve(null);
        } else {
          this._cache.set(path, sf);
          resolve(sf);
        }
        this._loadingPromises.delete(path);
      });
    });

    this._loadingPromises.set(path, promise);
    return promise;
  }

  public async preloadSpriteFrames(paths: string[]): Promise<void> {
    await Promise.all(paths.map((p) => this.getSpriteFrame(p)));
  }

  public clearCache(): void {
    this._cache.clear();
    this._loadingPromises.clear();
  }

  public getCacheStats(): { cached: number; loading: number } {
    return {
      cached: this._cache.size,
      loading: this._loadingPromises.size,
    };
  }
}
