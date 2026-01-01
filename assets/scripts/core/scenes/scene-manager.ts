import { director } from "cc";
import { LoadingScreen } from "../../components/loading-screen/loading-screen";
import { AssetBundleManager, BundleName } from "../assets/asset-bundle-manager";

export enum SceneName {
  LOBBY = "LobbyScene",
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

  public async bootstrapApp(): Promise<void> {
    if (this._isLoading) return;
    this._isLoading = true;

    const loadingUI = director
      .getScene()
      ?.getComponentInChildren(LoadingScreen);
    if (loadingUI) {
      loadingUI.startLoading();

      loadingUI.setOnComplete(async () => {
        await this.loadGameScene();
      });
    }

    const bundles = [BundleName.GAME, BundleName.SYMBOLS, BundleName.AUDIO];
    const manager = AssetBundleManager.getInstance();

    for (let i = 0; i < bundles.length; i++) {
      await manager.loadBundle(bundles[i]);
      loadingUI?.updateProgress((i + 1) / bundles.length);
    }

    const gameBundle = manager.getBundle(BundleName.GAME);
    gameBundle?.preloadScene(`scene/${SceneName.GAME}`, () => {
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

  public loadLobbyScene(): void {
    if (this._isLoading) return;
    this._isLoading = true;

    director.loadScene(SceneName.LOBBY, () => {
      this._isLoading = false;
    });
  }

  public async loadGameSceneFromLobby(): Promise<void> {
    if (this._isLoading) return;
    this._isLoading = true;

    const manager = AssetBundleManager.getInstance();
    let gameBundle = manager.getBundle(BundleName.GAME);

    if (!gameBundle) {
      await manager.loadBundle(BundleName.GAME);
      gameBundle = manager.getBundle(BundleName.GAME);
    }

    if (gameBundle) {
      gameBundle.loadScene(`scene/${SceneName.LOADING}`, (err, sceneAsset) => {
        if (!err) {
          director.runScene(sceneAsset);
        }
        this._isLoading = false;
      });
    } else {
      this._isLoading = false;
    }
  }
}
