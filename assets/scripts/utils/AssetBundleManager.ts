import { Asset, AssetManager, assetManager, JsonAsset } from "cc";

export class AssetBundleManager {
  private static instance: AssetBundleManager | null = null;
  private loadedBundles: Map<string, AssetManager.Bundle> = new Map();

  private constructor() {}

  public static getInstance(): AssetBundleManager {
    if (!AssetBundleManager.instance) {
      AssetBundleManager.instance = new AssetBundleManager();
    }
    return AssetBundleManager.instance;
  }

  /**
   * Load a bundle by name
   * @param bundleName Name of the bundle to load
   * @returns Promise that resolves when bundle is loaded
   */
  public async loadBundle(
    bundleName: string
  ): Promise<AssetManager.Bundle | null> {
    // Check if already loaded
    if (this.loadedBundles.has(bundleName)) {
      return this.loadedBundles.get(bundleName)!;
    }

    try {
      const bundle = await new Promise<AssetManager.Bundle>(
        (resolve, reject) => {
          assetManager.loadBundle(bundleName, (err, bundle) => {
            if (err || !bundle) {
              reject(err || new Error(`Failed to load bundle: ${bundleName}`));
              return;
            }
            resolve(bundle);
          });
        }
      );

      this.loadedBundles.set(bundleName, bundle);
      return bundle;
    } catch (error) {
      console.error(
        `[AssetBundleManager] Failed to load bundle ${bundleName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Load multiple bundles at once
   * @param bundleNames Array of bundle names to load
   * @returns Promise that resolves when all bundles are loaded
   */
  public async loadBundles(bundleNames: string[]): Promise<void> {
    await Promise.all(bundleNames.map((name) => this.loadBundle(name)));
  }

  /**
   * Get a loaded bundle
   * @param bundleName Name of the bundle
   * @returns Bundle if loaded, null otherwise
   */
  public getBundle(bundleName: string): AssetManager.Bundle | null {
    return this.loadedBundles.get(bundleName) || null;
  }

  /**
   * Load a resource from a specific bundle
   * @param bundleName Name of the bundle
   * @param path Path to the resource within the bundle
   * @param type Type of asset to load
   * @returns Promise that resolves with the loaded asset
   */
  public async load<T extends typeof Asset>(
    bundleName: string,
    path: string,
    type: T
  ): Promise<InstanceType<T> | null> {
    const bundle = await this.loadBundle(bundleName);
    if (!bundle) {
      return null;
    }

    try {
      return await new Promise<InstanceType<T> | null>((resolve) => {
        bundle.load(path, type, (err, asset) => {
          if (err || !asset) {
            console.warn(
              `[AssetBundleManager] Failed to load ${path} from ${bundleName}:`,
              err
            );
            resolve(null);
            return;
          }
          resolve(asset as InstanceType<T>);
        });
      });
    } catch (error) {
      console.error(
        `[AssetBundleManager] Error loading ${path} from ${bundleName}:`,
        error
      );
      return null;
    }
  }

  /**
   * Preload critical bundles for game start
   * Should be called during game initialization
   */
  public async preloadCriticalBundles(): Promise<void> {
    const criticalBundles = ["main", "symbols", "audio"];
    await this.loadBundles(criticalBundles);
  }

  /**
   * Preload all bundles (for offline mode or full preload)
   */
  public async preloadAllBundles(): Promise<void> {
    const allBundles = ["main", "symbols", "audio"];
    await this.loadBundles(allBundles);
  }

  /**
   * Release a bundle from memory
   * @param bundleName Name of the bundle to release
   */
  public releaseBundle(bundleName: string): void {
    const bundle = this.loadedBundles.get(bundleName);
    if (bundle) {
      assetManager.removeBundle(bundle);
      this.loadedBundles.delete(bundleName);
    }
  }

  /**
   * Release all bundles
   */
  public releaseAllBundles(): void {
    const bundleNames = Array.from(this.loadedBundles.keys());
    bundleNames.forEach((name) => this.releaseBundle(name));
  }

  /**
   * Check if a bundle is loaded
   * @param bundleName Name of the bundle
   * @returns True if bundle is loaded
   */
  public isBundleLoaded(bundleName: string): boolean {
    return this.loadedBundles.has(bundleName);
  }

  /**
   * Get bundle loading statistics
   */
  public getStats(): { loaded: number; bundleNames: string[] } {
    return {
      loaded: this.loadedBundles.size,
      bundleNames: Array.from(this.loadedBundles.keys()),
    };
  }
}
