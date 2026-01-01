import { director, SpriteFrame } from "cc";
import { LoadingScreen } from "../../components/loading-screen/loading-screen";
import { AssetBundleManager, BundleName } from "../assets/asset-bundle-manager";
import { SpriteFrameCache } from "../../utils/helpers/sprite-frame-cache";
import { SymbolPreloader } from "../../utils/helpers/symbol-preloader";
import { Logger } from "../../utils/helpers/logger";

const logger = Logger.create("SceneManager");

export enum SceneName {
  LOBBY = "LobbyScene",
  LOADING = "LoadingScene",
  GAME = "GameScene",
}

const SCENE_CONSTANTS = {
  SCENE_PATH_PREFIX: "scene/",
  LOADING_STEPS: {
    BUNDLES: 0.4, // 40% - Load 3 bundles
    SYMBOL_FRAMES: 0.2, // 20% - Load symbol frames
    PRELOAD_SYMBOLS: 0.3, // 30% - Preload all symbols
    PRELOAD_SCENE: 0.1, // 10% - Preload game scene
  },
} as const;

export class SceneManager {
  private static sharedInstance: SceneManager;
  private isLoading: boolean = false;
  private bundleManager: AssetBundleManager | null = null;

  public static get instance(): SceneManager {
    if (!this.sharedInstance) {
      this.sharedInstance = new SceneManager();
      this.sharedInstance.initialize();
    }
    return this.sharedInstance;
  }

  private initialize(): void {
    this.bundleManager = AssetBundleManager.getInstance();
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  private getScenePath(sceneName: SceneName): string {
    return `${SCENE_CONSTANTS.SCENE_PATH_PREFIX}${sceneName}`;
  }

  private resetLoadingState(): void {
    this.isLoading = false;
  }

  // ==========================================
  // App Bootstrap
  // ==========================================

  public async bootstrapApp(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    const loadingUI = this.getLoadingScreen();

    if (loadingUI) {
      this.setupLoadingScreen(loadingUI);
    }

    let loadingSuccess = false;

    try {
      await this.loadAllBundles(loadingUI);
      await this.preloadGameScene(loadingUI);
      loadingSuccess = true;
      logger.info("All assets loaded successfully");
    } catch (error) {
      logger.error("Failed to bootstrap app:", error);
      this.handleLoadingError(loadingUI, error);
    } finally {
      this.resetLoadingState();
    }

    if (!loadingSuccess && loadingUI) {
      loadingUI.setOnComplete(() => {
        logger.error("Loading failed - preventing scene transition");
      });
    }
  }

  private handleLoadingError(
    loadingUI: LoadingScreen | null,
    error: unknown
  ): void {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    logger.error("Loading failed:", errorMessage);

    if (loadingUI?.messageLabel?.isValid) {
      loadingUI.messageLabel.string = "Failed to load game. Please refresh.";
    }
  }

  private getLoadingScreen(): LoadingScreen | null {
    return director.getScene()?.getComponentInChildren(LoadingScreen) || null;
  }

  private setupLoadingScreen(loadingUI: LoadingScreen): void {
    loadingUI.startLoading();
    loadingUI.setOnComplete(async () => {
      logger.info("Loading complete - transitioning to game scene");
      await this.loadGameScene();
    });
  }

  private async loadAllBundles(loadingUI: LoadingScreen | null): Promise<void> {
    if (!this.bundleManager) {
      throw new Error("AssetBundleManager not initialized");
    }

    let currentProgress = 0;

    // Step 1: Load all bundles in parallel (0 → 40%)
    logger.info("Loading asset bundles...");
    try {
      await Promise.all([
        this.bundleManager.loadBundle(BundleName.GAME),
        this.bundleManager.loadBundle(BundleName.SYMBOLS),
        this.bundleManager.loadBundle(BundleName.AUDIO),
      ]);
      currentProgress += SCENE_CONSTANTS.LOADING_STEPS.BUNDLES;
      loadingUI?.updateProgress(currentProgress);
      logger.info("Asset bundles loaded successfully");
    } catch (error) {
      logger.error("Failed to load asset bundles:", error);
      throw new Error("Failed to load required asset bundles");
    }

    // Step 2: Load and cache symbol frames (40% → 60%)
    try {
      await this.loadSymbolFrames();
      currentProgress += SCENE_CONSTANTS.LOADING_STEPS.SYMBOL_FRAMES;
      loadingUI?.updateProgress(currentProgress);
      logger.info("Symbol frames loaded successfully");
    } catch (error) {
      logger.error("Failed to load symbol frames:", error);
      throw new Error("Failed to load symbol frames");
    }

    // Step 3: Preload all symbols (60% → 90%)
    try {
      await SymbolPreloader.preloadAll();
      currentProgress += SCENE_CONSTANTS.LOADING_STEPS.PRELOAD_SYMBOLS;
      loadingUI?.updateProgress(currentProgress);
      logger.info("Symbols preloaded successfully");
    } catch (error) {
      logger.error("Failed to preload symbols:", error);
      throw new Error("Failed to preload symbols");
    }
  }

  private async loadSymbolFrames(): Promise<void> {
    if (!this.bundleManager) {
      throw new Error("AssetBundleManager not initialized");
    }

    const symbolFrames = await this.bundleManager.loadDir(
      BundleName.SYMBOLS,
      "",
      SpriteFrame
    );

    if (!symbolFrames || symbolFrames.length === 0) {
      throw new Error("No symbol frames found in bundle");
    }

    const cache = SpriteFrameCache.getInstance();
    symbolFrames.forEach((frame) => {
      cache.setStaticCache(BundleName.SYMBOLS, frame.name, frame);
    });
    logger.info(`Cached ${symbolFrames.length} symbol frames`);
  }

  private async preloadGameScene(
    loadingUI: LoadingScreen | null
  ): Promise<void> {
    if (!this.bundleManager) return;

    // Step 4: Preload game scene (90% → 100%)
    logger.info("Preloading game scene...");
    const gameBundle = this.bundleManager.getBundle(BundleName.GAME);
    const scenePath = this.getScenePath(SceneName.GAME);

    await new Promise<void>((resolve, reject) => {
      gameBundle?.preloadScene(scenePath, (err) => {
        if (err) {
          logger.error("Failed to preload game scene:", err);
          reject(err);
        } else {
          loadingUI?.updateProgress(1.0);
          logger.info("Game scene preloaded - Loading complete!");
          resolve();
        }
      });
    });
  }

  // ==========================================
  // Scene Loading
  // ==========================================

  private async loadGameScene(): Promise<void> {
    if (!this.bundleManager) {
      logger.error("AssetBundleManager not available");
      return;
    }

    const gameBundle = this.bundleManager.getBundle(BundleName.GAME);
    const scenePath = this.getScenePath(SceneName.GAME);

    this.loadSceneFromBundle(gameBundle, scenePath, "game scene");
  }

  private loadSceneFromBundle(
    bundle: any,
    scenePath: string,
    sceneName: string
  ): void {
    bundle?.loadScene(scenePath, (err: any, sceneAsset: any) => {
      if (err) {
        logger.error(`Failed to load ${sceneName}:`, err);
        this.resetLoadingState();
        return;
      }
      director.runScene(sceneAsset);
      this.resetLoadingState();
    });
  }

  public loadLobbyScene(): void {
    if (this.isLoading) return;
    this.isLoading = true;

    director.loadScene(SceneName.LOBBY, (err) => {
      if (err) {
        logger.error("Failed to load lobby scene:", err);
      }
      this.resetLoadingState();
    });
  }

  public async loadGameSceneFromLobby(): Promise<void> {
    if (this.isLoading) return;
    this.isLoading = true;

    if (!this.bundleManager) {
      logger.error("AssetBundleManager not available");
      this.resetLoadingState();
      return;
    }

    const gameBundle = await this.ensureGameBundle();
    if (!gameBundle) {
      logger.error("Game bundle not available");
      this.resetLoadingState();
      return;
    }

    const scenePath = this.getScenePath(SceneName.LOADING);
    this.loadSceneFromBundle(gameBundle, scenePath, "loading scene");
  }

  private async ensureGameBundle(): Promise<any> {
    if (!this.bundleManager) return null;

    let gameBundle = this.bundleManager.getBundle(BundleName.GAME);

    if (!gameBundle) {
      await this.bundleManager.loadBundle(BundleName.GAME);
      gameBundle = this.bundleManager.getBundle(BundleName.GAME);
    }

    return gameBundle;
  }
}
