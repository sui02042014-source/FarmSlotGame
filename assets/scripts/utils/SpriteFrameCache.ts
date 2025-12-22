import { SpriteFrame, resources } from "cc";

export class SpriteFrameCache {
  private static instance: SpriteFrameCache | null = null;
  private cache: Map<string, SpriteFrame> = new Map();
  private loading: Map<string, Promise<SpriteFrame | null>> = new Map();

  private constructor() {}

  public static getInstance(): SpriteFrameCache {
    if (!SpriteFrameCache.instance) {
      SpriteFrameCache.instance = new SpriteFrameCache();
    }
    return SpriteFrameCache.instance;
  }

  public async getSpriteFrame(path: string): Promise<SpriteFrame | null> {
    const cached = this.cache.get(path);
    if (cached) {
      return cached;
    }

    const existing = this.loading.get(path);
    if (existing) {
      return existing;
    }

    const loader = new Promise<SpriteFrame | null>((resolve) => {
      resources.load(path, SpriteFrame, (err, spriteFrame) => {
        if (err || !spriteFrame) {
          resolve(null);
          return;
        }
        this.cache.set(path, spriteFrame);
        resolve(spriteFrame);
      });
    });

    this.loading.set(path, loader);
    loader.then(
      () => this.loading.delete(path),
      () => this.loading.delete(path)
    );

    return loader;
  }

  public async preloadSpriteFrames(paths: string[]): Promise<void> {
    await Promise.all(paths.map((path) => this.getSpriteFrame(path)));
  }

  public clearCache(): void {
    this.cache.clear();
    this.loading.clear();
  }

  public getCacheStats(): { cached: number; loading: number } {
    return {
      cached: this.cache.size,
      loading: this.loading.size,
    };
  }
}
