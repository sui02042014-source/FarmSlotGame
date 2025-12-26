import { director } from "cc";
import { LoadingScreen } from "../../components/loading-screen/LoadingScreen";
import {
  AssetBundleManager,
  BundleName,
} from "../asset-manager/AssetBundleManager";

export enum SceneName {
  LOADING = "LoadingScene",
  GAME = "GameScene",
}

export class SceneManager {
  private static _instance: SceneManager;
  private _isLoading: boolean = false;

  public static get instance(): SceneManager {
    if (!this._instance) this._instance = new SceneManager();
    return this._instance;
  }

  /**
   * Khởi động Flow: Tải hết -> Hiện nút -> Click vào Game
   */
  public async bootstrapApp(): Promise<void> {
    if (this._isLoading) return;
    this._isLoading = true;

    const loadingUI = director
      .getScene()
      ?.getComponentInChildren(LoadingScreen);
    if (loadingUI) {
      loadingUI.startLoading();

      // Đăng ký: Khi nào click Play mới gọi hàm đổi Scene
      loadingUI.setOnComplete(async () => {
        await this.loadGameScene();
      });
    }

    // Tiến hành tải tài nguyên
    const bundles = [BundleName.GAME, BundleName.SYMBOLS, BundleName.AUDIO];
    const manager = AssetBundleManager.getInstance();

    for (let i = 0; i < bundles.length; i++) {
      await manager.loadBundle(bundles[i]);
      loadingUI?.updateProgress((i + 1) / bundles.length);
    }

    // Preload Scene Game để khi click nút Play là vào ngay lập tức
    const gameBundle = manager.getBundle(BundleName.GAME);
    gameBundle?.preloadScene(`scene/${SceneName.GAME}`, () => {
      console.log("[SceneManager] Game Scene Preloaded");
      // Đảm bảo progress visual đạt 100%
      loadingUI?.updateProgress(1.0);
    });
  }

  private async loadGameScene() {
    const gameBundle = AssetBundleManager.getInstance().getBundle(
      BundleName.GAME
    );
    gameBundle?.loadScene(`scene/${SceneName.GAME}`, (err, sceneAsset) => {
      if (!err) {
        director.runScene(sceneAsset);
        this._isLoading = false;
      }
    });
  }
}
