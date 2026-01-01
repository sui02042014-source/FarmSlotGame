import { director } from "cc";
import { LoadingScreen } from "../../components/loading-screen/loading-screen";
import { AssetBundleManager, BundleName } from "../assets/asset-bundle-manager";
import { Logger } from "../../utils/helpers/logger";

const logger = Logger.create("SceneManager");

export enum SceneName {
  LOBBY = "LobbyScene",
  LOADING = "LoadingScene",
  GAME = "GameScene",
}

const SCENE_CONSTANTS = {
  SCENE_PATH_PREFIX: "scene/",
  TOTAL_LOADING_STEPS: 1, // bundles + preload
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

    await this.loadAllBundles(loadingUI);
    await this.preloadGameScene(loadingUI);
  }

  private getLoadingScreen(): LoadingScreen | null {
    return director.getScene()?.getComponentInChildren(LoadingScreen) || null;
  }

  private setupLoadingScreen(loadingUI: LoadingScreen): void {
    loadingUI.startLoading();
    loadingUI.setOnComplete(async () => {
      await this.loadGameScene();
    });
  }

  private async loadAllBundles(loadingUI: LoadingScreen | null): Promise<void> {
    if (!this.bundleManager) return;

    const bundles = [BundleName.GAME, BundleName.SYMBOLS, BundleName.AUDIO];
    const totalSteps = bundles.length + SCENE_CONSTANTS.TOTAL_LOADING_STEPS;

    for (let i = 0; i < bundles.length; i++) {
      await this.bundleManager.loadBundle(bundles[i]);
      loadingUI?.updateProgress((i + 1) / totalSteps);
    }
  }

  private async preloadGameScene(
    loadingUI: LoadingScreen | null
  ): Promise<void> {
    if (!this.bundleManager) return;

    const gameBundle = this.bundleManager.getBundle(BundleName.GAME);
    const scenePath = this.getScenePath(SceneName.GAME);

    await new Promise<void>((resolve, reject) => {
      gameBundle?.preloadScene(scenePath, (err) => {
        if (err) {
          logger.error("Failed to preload game scene:", err);
          reject(err);
        } else {
          loadingUI?.updateProgress(1.0);
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
