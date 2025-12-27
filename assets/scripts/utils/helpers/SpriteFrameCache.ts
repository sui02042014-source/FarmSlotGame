import { SpriteFrame, SpriteAtlas } from "cc";

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
    frames.forEach((sf) => {
      this._cache.set(this.makeKey(bundleName, sf.name), sf);
    });
    console.log(`[SpriteFrameCache] Atlas cached: ${frames.length} frames`);
  }

  public setStaticCache(bundle: string, path: string, sf: SpriteFrame): void {
    this._cache.set(this.makeKey(bundle, path), sf);
  }

  public getSpriteFrame(bundle: string, path: string): SpriteFrame | null {
    return this._cache.get(this.makeKey(bundle, path)) || null;
  }

  public clear(): void {
    this._cache.clear();
  }
}
