import { Asset, AssetManager, assetManager } from "cc";

export enum BundleName {
  SYMBOLS = "symbols",
  AUDIO = "audio",
  GAME = "game",
}

export class AssetBundleManager {
  private static _instance: AssetBundleManager | null = null;

  private _loadedBundles = new Map<string, AssetManager.Bundle>();
  private _loadingPromises = new Map<
    string,
    Promise<AssetManager.Bundle | null>
  >();

  private constructor() {}

  public static getInstance(): AssetBundleManager {
    if (!this._instance) {
      this._instance = new AssetBundleManager();
    }
    return this._instance;
  }

  public async loadBundle(
    bundleName: string
  ): Promise<AssetManager.Bundle | null> {
    if (this._loadedBundles.has(bundleName)) {
      return this._loadedBundles.get(bundleName)!;
    }

    if (this._loadingPromises.has(bundleName)) {
      return this._loadingPromises.get(bundleName)!;
    }

    const loadPromise = new Promise<AssetManager.Bundle | null>((resolve) => {
      assetManager.loadBundle(bundleName, (err, bundle) => {
        if (err) {
          console.error(
            `[AssetBundleManager] Failed to load bundle: ${bundleName}`,
            err
          );
          resolve(null);
        } else {
          this._loadedBundles.set(bundleName, bundle);
          resolve(bundle);
        }
        this._loadingPromises.delete(bundleName);
      });
    });

    this._loadingPromises.set(bundleName, loadPromise);
    return loadPromise;
  }

  public async loadBundles(bundleNames: string[]): Promise<void> {
    await Promise.all(bundleNames.map((name) => this.loadBundle(name)));
  }

  public async load<T extends Asset>(
    bundleName: string,
    path: string,
    type: { new (): T } | null = null
  ): Promise<T | null> {
    const bundle = await this.loadBundle(bundleName);
    if (!bundle) return null;

    return new Promise((resolve) => {
      // Nếu type null, engine sẽ tự đoán type
      bundle.load(path, type as any, (err, asset) => {
        if (err) {
          console.warn(
            `[AssetBundleManager] Load failed: ${path} in ${bundleName}`,
            err
          );
          resolve(null);
        } else {
          resolve(asset as T);
        }
      });
    });
  }

  public async loadDir<T extends Asset>(
    bundleName: string,
    path: string,
    type: { new (): T }
  ): Promise<T[] | null> {
    const bundle = await this.loadBundle(bundleName);
    if (!bundle) return null;

    return new Promise((resolve) => {
      bundle.loadDir(path, type, (err, assets) => {
        if (err) {
          console.error(`[AssetBundleManager] LoadDir failed: ${path}`, err);
          resolve(null);
        } else {
          resolve(assets as T[]);
        }
      });
    });
  }

  public async preloadCriticalBundles(): Promise<void> {
    const critical = [BundleName.SYMBOLS, BundleName.AUDIO, BundleName.GAME];
    await this.loadBundles(critical);
  }

  public releaseBundle(bundleName: string): void {
    const bundle = this._loadedBundles.get(bundleName);
    if (bundle) {
      bundle.releaseAll();
      assetManager.removeBundle(bundle);
      this._loadedBundles.delete(bundleName);
      console.log(`[AssetBundleManager] Released bundle: ${bundleName}`);
    }
  }

  public releaseAllBundles(): void {
    const names = Array.from(this._loadedBundles.keys());
    names.forEach((name) => this.releaseBundle(name));
  }

  public getBundle(bundleName: string): AssetManager.Bundle | null {
    return (
      assetManager.getBundle(bundleName) ||
      this._loadedBundles.get(bundleName) ||
      null
    );
  }

  public isBundleLoaded(bundleName: string): boolean {
    return this._loadedBundles.has(bundleName);
  }
}
