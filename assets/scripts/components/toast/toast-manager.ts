import {
  _decorator,
  Component,
  Node,
  Prefab,
  instantiate,
  Vec3,
  game,
} from "cc";
import { ToastItem } from "./toast-item";
import {
  AssetBundleManager,
  BundleName,
} from "../../core/assets/asset-bundle-manager";

const { ccclass, property } = _decorator;

const TOAST_PREFAB_PATH = "Toast";
const SCENE_WAIT_TIMEOUT = 2000;
const SCENE_CHECK_INTERVAL = 16;

@ccclass("ToastManager")
export class ToastManager extends Component {
  @property(Prefab)
  toastPrefab: Prefab = null!;

  private static instance: ToastManager = null!;
  private toastPool: Node[] = [];
  private prefabLoadPromise: Promise<Prefab | null> | null = null;

  public static getInstance(): ToastManager | null {
    if (this.instance && !this.instance.isNodeValid()) {
      this.instance = null!;
    }
    return this.instance;
  }

  protected onLoad(): void {
    this.initializeSingleton();
  }

  protected start(): void {
    this.repositionToCanvas();
  }

  protected onDestroy(): void {
    this.cleanup();
  }

  public async show(message: string, duration: number = 2.0): Promise<void> {
    try {
      if (!this.validateNode()) return;
      if (!(await this.ensureNodeInScene())) return;
      if (!(await this.ensurePrefabLoaded())) return;

      this.repositionToCanvas();

      const toastNode = this.getOrCreateToast();
      if (!toastNode) return;

      this.displayToast(toastNode, message, duration);
    } catch (error) {
      console.error("[ToastManager] Failed to show toast:", message, error);
    }
  }

  private initializeSingleton(): void {
    if (ToastManager.instance && ToastManager.instance !== this) {
      if (!ToastManager.instance.isNodeValid()) {
        this.replaceSingleton();
      } else {
        this.node.destroy();
      }
      return;
    }

    ToastManager.instance = this;
    game.addPersistRootNode(this.node);
    this.ensurePrefabLoaded().catch((error) => {
      console.error("[ToastManager] Failed to load prefab during init:", error);
    });
  }

  private replaceSingleton(): void {
    ToastManager.instance = this;
    game.addPersistRootNode(this.node);
    this.ensurePrefabLoaded().catch((error) => {
      console.error(
        "[ToastManager] Failed to load prefab during replacement:",
        error
      );
    });
  }

  private cleanup(): void {
    if (ToastManager.instance === this) {
      ToastManager.instance = null!;
    }
    this.clearPool();
  }

  private clearPool(): void {
    if (!this.toastPool) return;

    for (const toast of this.toastPool) {
      if (toast?.isValid) {
        toast.destroy();
      }
    }
    this.toastPool = [];
  }

  private isNodeValid(): boolean {
    return this.node?.isValid ?? false;
  }

  private validateNode(): boolean {
    if (!this.isNodeValid()) {
      return false;
    }
    return true;
  }

  private async ensureNodeInScene(): Promise<boolean> {
    if (!this.node.scene) {
      await this.waitForScene();
      if (!this.isNodeValid() || !this.node.scene) {
        return false;
      }
    }
    return true;
  }

  private waitForScene(): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();

      const checkScene = () => {
        if (this.node?.scene) {
          resolve();
        } else if (Date.now() - startTime > SCENE_WAIT_TIMEOUT) {
          reject(new Error("Timeout waiting for scene"));
        } else {
          setTimeout(checkScene, SCENE_CHECK_INTERVAL);
        }
      };

      checkScene();
    });
  }

  private repositionToCanvas(): void {
    if (!this.isNodeValid() || !this.node.scene) return;

    const canvas = this.node.scene.getComponentInChildren("cc.Canvas")?.node;
    if (canvas && this.node.parent !== canvas) {
      this.node.setParent(canvas);
      this.node.setSiblingIndex(this.node.parent!.children.length - 1);
    }

    this.node.setPosition(Vec3.ZERO);
  }

  private displayToast(
    toastNode: Node,
    message: string,
    duration: number
  ): void {
    toastNode.active = true;
    toastNode.setParent(this.node);
    toastNode.setSiblingIndex(this.node.children.length - 1);

    const toastItem = toastNode.getComponent(ToastItem);
    if (toastItem) {
      toastItem.show(message, duration);
    }
  }

  private getOrCreateToast(): Node | null {
    if (!this.toastPool) {
      this.toastPool = [];
    }

    const inactiveToast = this.findInactiveToast();
    if (inactiveToast) {
      return inactiveToast;
    }

    return this.createNewToast();
  }

  private findInactiveToast(): Node | null {
    return this.toastPool.find((n) => n?.isValid && !n.active) || null;
  }

  private createNewToast(): Node | null {
    if (!this.toastPrefab) {
      return null;
    }

    const toast = instantiate(this.toastPrefab);
    this.toastPool.push(toast);
    return toast;
  }

  private async ensurePrefabLoaded(): Promise<boolean> {
    if (this.toastPrefab) {
      return true;
    }

    if (this.prefabLoadPromise) {
      await this.prefabLoadPromise;
      return this.toastPrefab !== null;
    }

    this.prefabLoadPromise = this.loadPrefabFromBundle();
    await this.prefabLoadPromise;
    this.prefabLoadPromise = null;

    if (!this.toastPrefab) {
      return false;
    }

    return true;
  }

  private async loadPrefabFromBundle(): Promise<Prefab | null> {
    try {
      const bundleManager = AssetBundleManager.getInstance();

      let prefab = await this.tryLoadFromPrefabsBundle(bundleManager);
      if (!prefab) {
        prefab = await this.tryLoadFromGameBundle(bundleManager);
      }

      if (prefab) {
        this.toastPrefab = prefab;
      }

      return prefab;
    } catch (error) {
      console.error("[ToastManager] Failed to load prefab from bundle:", error);
      return null;
    }
  }

  private async tryLoadFromPrefabsBundle(
    bundleManager: AssetBundleManager
  ): Promise<Prefab | null> {
    return await bundleManager.load(
      BundleName.PREFABS,
      TOAST_PREFAB_PATH,
      Prefab
    );
  }

  private async tryLoadFromGameBundle(
    bundleManager: AssetBundleManager
  ): Promise<Prefab | null> {
    return await bundleManager.load(
      BundleName.GAME,
      `prefabs/${TOAST_PREFAB_PATH}`,
      Prefab
    );
  }
}
