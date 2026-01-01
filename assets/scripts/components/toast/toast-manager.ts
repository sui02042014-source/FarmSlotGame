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
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;

const logger = Logger.create("ToastManager");

const TOAST_CONSTANTS = {
  PREFAB_PATH: "Toast",
  PREFAB_PATH_WITH_DIR: "prefabs/Toast",
  SCENE_WAIT_TIMEOUT: 2000,
  SCENE_CHECK_INTERVAL: 16,
  CANVAS_COMPONENT_NAME: "cc.Canvas",
} as const;

@ccclass("ToastManager")
export class ToastManager extends Component {
  @property(Prefab)
  toastPrefab: Prefab = null!;

  private static instance: ToastManager = null!;
  private toastPool: Node[] = [];
  private prefabLoadPromise: Promise<Prefab | null> | null = null;
  private bundleManager: AssetBundleManager | null = null;

  public static getInstance(): ToastManager | null {
    if (this.instance && !this.instance.isNodeValid()) {
      this.instance = null!;
    }
    return this.instance;
  }

  protected onLoad(): void {
    this.cacheManagers();
    this.initializeSingleton();
  }

  private cacheManagers(): void {
    this.bundleManager = AssetBundleManager.getInstance();
  }

  protected start(): void {
    this.repositionToCanvas();
  }

  protected onDestroy(): void {
    this.cleanup();
  }

  // ==========================================
  // Public API
  // ==========================================

  public async show(message: string, duration: number = 2.0): Promise<void> {
    try {
      if (!this.isNodeValid()) return;
      if (!(await this.ensureNodeInScene())) return;
      if (!(await this.ensurePrefabLoaded())) return;

      this.repositionToCanvas();

      const toastNode = this.getOrCreateToast();
      if (!toastNode) return;

      this.displayToast(toastNode, message, duration);
    } catch (error) {
      logger.error("Failed to show toast:", message, error);
    }
  }

  // ==========================================
  // Singleton Management
  // ==========================================

  private initializeSingleton(): void {
    if (ToastManager.instance && ToastManager.instance !== this) {
      if (!ToastManager.instance.isNodeValid()) {
        this.replaceSingleton();
      } else {
        this.node.destroy();
      }
      return;
    }

    this.setupAsSingleton();
  }

  private setupAsSingleton(): void {
    ToastManager.instance = this;
    this.persistNodeIfNeeded();
    this.preloadPrefab();
  }

  private replaceSingleton(): void {
    ToastManager.instance = this;
    game.addPersistRootNode(this.node);
    this.preloadPrefab();
  }

  private persistNodeIfNeeded(): void {
    if (this.node.parent && this.node.parent === this.node.scene) {
      game.addPersistRootNode(this.node);
    }
  }

  private preloadPrefab(): void {
    this.ensurePrefabLoaded().catch((error) => {
      logger.error("Failed to load prefab:", error);
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
    this.toastPool.length = 0;
  }

  // ==========================================
  // Validation
  // ==========================================

  private isNodeValid(): boolean {
    return this.node?.isValid ?? false;
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
        } else if (
          Date.now() - startTime >
          TOAST_CONSTANTS.SCENE_WAIT_TIMEOUT
        ) {
          reject(new Error("Timeout waiting for scene"));
        } else {
          setTimeout(checkScene, TOAST_CONSTANTS.SCENE_CHECK_INTERVAL);
        }
      };

      checkScene();
    });
  }

  // ==========================================
  // Positioning
  // ==========================================

  private repositionToCanvas(): void {
    if (!this.isNodeValid() || !this.node.scene) return;

    const canvas = this.node.scene.getComponentInChildren(
      TOAST_CONSTANTS.CANVAS_COMPONENT_NAME
    )?.node;

    if (canvas && this.node.parent !== canvas) {
      this.node.setParent(canvas);
      this.node.setSiblingIndex(this.node.parent!.children.length - 1);
    }

    this.node.setPosition(Vec3.ZERO);
  }

  // ==========================================
  // Toast Display
  // ==========================================

  private displayToast(
    toastNode: Node,
    message: string,
    duration: number
  ): void {
    this.activateToastNode(toastNode);
    this.showToastMessage(toastNode, message, duration);
  }

  private activateToastNode(toastNode: Node): void {
    toastNode.active = true;
    toastNode.setParent(this.node);
    toastNode.setSiblingIndex(this.node.children.length - 1);
  }

  private showToastMessage(
    toastNode: Node,
    message: string,
    duration: number
  ): void {
    const toastItem = toastNode.getComponent(ToastItem);
    if (toastItem) {
      toastItem.show(message, duration);
    }
  }

  // ==========================================
  // Toast Pool Management
  // ==========================================

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

  // ==========================================
  // Prefab Loading
  // ==========================================

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

    return this.toastPrefab !== null;
  }

  private async loadPrefabFromBundle(): Promise<Prefab | null> {
    if (!this.bundleManager) {
      logger.error("AssetBundleManager not available");
      return null;
    }

    try {
      let prefab = await this.tryLoadFromPrefabsBundle();
      if (!prefab) {
        prefab = await this.tryLoadFromGameBundle();
      }

      if (prefab) {
        this.toastPrefab = prefab;
      }

      return prefab;
    } catch (error) {
      logger.error("Failed to load prefab from bundle:", error);
      return null;
    }
  }

  private async tryLoadFromPrefabsBundle(): Promise<Prefab | null> {
    return await this.bundleManager!.load(
      BundleName.PREFABS,
      TOAST_CONSTANTS.PREFAB_PATH,
      Prefab
    );
  }

  private async tryLoadFromGameBundle(): Promise<Prefab | null> {
    return await this.bundleManager!.load(
      BundleName.GAME,
      TOAST_CONSTANTS.PREFAB_PATH_WITH_DIR,
      Prefab
    );
  }
}
