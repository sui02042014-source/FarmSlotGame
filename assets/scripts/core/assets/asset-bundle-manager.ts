import {
  Asset,
  AssetManager,
  assetManager,
  Constructor,
  SpriteAtlas,
} from "cc";

export enum BundleName {
  SYMBOLS = "symbols",
  AUDIO = "audio",
  GAME = "game",
  PREFABS = "prefabs",
}

export class AssetBundleManager {
  private static _instance: AssetBundleManager | null = null;
  private _loadedBundles = new Map<string, AssetManager.Bundle>();
  private _loadingPromises = new Map<
    string,
    Promise<AssetManager.Bundle | null>
  >();

  public static getInstance(): AssetBundleManager {
    if (!this._instance) this._instance = new AssetBundleManager();
    return this._instance;
  }

  public async loadBundle(
    bundleName: string
  ): Promise<AssetManager.Bundle | null> {
    if (this._loadedBundles.has(bundleName))
      return this._loadedBundles.get(bundleName)!;
    if (this._loadingPromises.has(bundleName))
      return this._loadingPromises.get(bundleName)!;

    const promise = new Promise<AssetManager.Bundle | null>((resolve) => {
      assetManager.loadBundle(bundleName, (err, bundle) => {
        this._loadingPromises.delete(bundleName);
        if (err) {
          resolve(null);
        } else {
          this._loadedBundles.set(bundleName, bundle);
          resolve(bundle);
        }
      });
    });
    this._loadingPromises.set(bundleName, promise);
    return promise;
  }

  public async load<T extends Asset>(
    bundleName: string,
    path: string,
    type: Constructor<T>
  ): Promise<T | null> {
    const bundle = await this.loadBundle(bundleName);
    if (!bundle) return null;
    return new Promise((resolve) => {
      bundle.load(path, type, (err, asset) => {
        if (err) resolve(null);
        else resolve(asset as T);
      });
    });
  }

  public async loadDir<T extends Asset>(
    bundleName: string,
    path: string,
    type: Constructor<T>
  ): Promise<T[]> {
    const bundle = await this.loadBundle(bundleName);
    if (!bundle) return [];
    return new Promise((resolve) => {
      bundle.loadDir(path, type, (err, assets) => {
        if (err) resolve([]);
        else resolve(assets as T[]);
      });
    });
  }

  public async loadAtlas(
    bundleName: string,
    path: string
  ): Promise<SpriteAtlas | null> {
    return this.load(bundleName, path, SpriteAtlas);
  }

  public getBundle(bundleName: string): AssetManager.Bundle | null {
    return this._loadedBundles.get(bundleName) || null;
  }

  /**
   * Release a specific bundle and all its assets
   */
  public releaseBundle(bundleName: string): void {
    const bundle = this._loadedBundles.get(bundleName);
    if (bundle) {
      bundle.releaseAll();
      assetManager.removeBundle(bundle);
      this._loadedBundles.delete(bundleName);
      console.log(`[AssetBundleManager] Released bundle: ${bundleName}`);
    }
  }

  /**
   * Release all loaded bundles
   */
  public releaseAll(): void {
    this._loadedBundles.forEach((bundle, name) => {
      bundle.releaseAll();
      assetManager.removeBundle(bundle);
      console.log(`[AssetBundleManager] Released bundle: ${name}`);
    });
    this._loadedBundles.clear();
    this._loadingPromises.clear();
  }

  /**
   * Get memory usage statistics
   */
  public getStats(): { bundleCount: number; bundleNames: string[] } {
    return {
      bundleCount: this._loadedBundles.size,
      bundleNames: Array.from(this._loadedBundles.keys()),
    };
  }
}
