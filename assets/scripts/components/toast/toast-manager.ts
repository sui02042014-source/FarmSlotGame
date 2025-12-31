import { _decorator, Component, Node, Prefab, instantiate, Vec3 } from "cc";
import { ToastItem } from "./toast-item";

const { ccclass, property } = _decorator;

@ccclass("ToastManager")
export class ToastManager extends Component {
  @property(Prefab)
  toastPrefab: Prefab = null!;

  private static instance: ToastManager = null!;
  private toastPool: Node[] = [];

  public static getInstance(): ToastManager {
    return this.instance;
  }

  protected onLoad(): void {
    if (ToastManager.instance && ToastManager.instance !== this) {
      this.node.destroy();
      return;
    }
    ToastManager.instance = this;

    const canvas = this.node.scene.getComponentInChildren("cc.Canvas")?.node;
    if (canvas) {
      this.node.setParent(canvas);
      this.node.setSiblingIndex(this.node.parent!.children.length - 1);
    }
    this.node.setPosition(Vec3.ZERO);
  }

  public show(message: string, duration: number = 2.0): void {
    console.log(`[ToastManager] Showing message: ${message}`);
    const toastNode = this.getToastFromPool();
    if (!toastNode) return;

    toastNode.active = true;
    toastNode.setParent(this.node);
    toastNode.setSiblingIndex(this.node.children.length - 1);

    const toastItem = toastNode.getComponent(ToastItem);
    if (toastItem) {
      toastItem.show(message, duration);
    }
  }

  private getToastFromPool(): Node {
    let toast = this.toastPool.find((n) => !n.active);
    if (!toast) {
      toast = instantiate(this.toastPrefab);
      this.toastPool.push(toast);
    }
    return toast;
  }
}
