import { _decorator, Component, Node, instantiate, Prefab, game } from "cc";
import { BaseModal } from "./base-modal";
const { ccclass, property } = _decorator;

@ccclass("ModalManager")
export class ModalManager extends Component {
  @property(Node)
  modalContainer: Node = null!;

  @property(Prefab)
  winModalPrefab: Prefab = null!;

  @property(Prefab)
  paytableModalPrefab: Prefab = null!;

  @property(Prefab)
  settingsModalPrefab: Prefab = null!;

  private static instance: ModalManager = null!;
  private activeModals: Map<string, Node> = new Map();
  private modalQueue: Array<{ name: string; data: any; onClose?: () => void }> =
    [];
  private isShowingModal: boolean = false;

  public static getInstance(): ModalManager | null {
    if (this.instance && !this.instance.node?.isValid) {
      this.instance = null!;
    }
    return this.instance;
  }

  protected onLoad(): void {
    if (ModalManager.instance && ModalManager.instance !== this) {
      if (!ModalManager.instance.node?.isValid) {
        this.initializeAsSingleton();
      } else {
        this.node.destroy();
      }
      return;
    }

    this.initializeAsSingleton();
  }

  protected start(): void {
    this.repositionToCanvas();
  }

  protected onDestroy(): void {
    if (ModalManager.instance === this) {
      ModalManager.instance = null!;
    }
    this.closeAllModals();
  }

  private initializeAsSingleton(): void {
    ModalManager.instance = this;

    // Only persist if this node is at root level (direct child of scene)
    if (this.node.parent && this.node.parent === this.node.scene) {
      game.addPersistRootNode(this.node);
    }

    if (!this.modalContainer) {
      this.modalContainer = new Node("ModalContainer");
      this.modalContainer.setParent(this.node);
    }

    this.repositionToCanvas();
  }

  private repositionToCanvas(): void {
    if (!this.node?.isValid || !this.node.scene) return;

    const canvas = this.node.scene.getComponentInChildren("cc.Canvas")?.node;
    if (canvas && this.node.parent !== canvas) {
      this.node.setParent(canvas);
      this.node.setSiblingIndex(this.node.parent!.children.length - 1);
    }
  }

  public getOverlayContainer(): Node {
    return this.modalContainer;
  }

  public showWinModal(
    winAmount: number,
    betAmount: number,
    onClose?: () => void
  ): void {
    this.showModal("WinModal", { winAmount, betAmount }, onClose);
  }

  public showPaytableModal(onClose?: () => void): void {
    this.showModal("PaytableModal", {}, onClose);
  }

  public showSettingsModal(onClose?: () => void): void {
    this.showModal("SettingsModal", {}, onClose);
  }

  public showModal(
    modalName: string,
    data: any = {},
    onClose?: () => void
  ): void {
    if (
      this.isModalActive(modalName) ||
      this.modalQueue.some((m) => m.name === modalName)
    ) {
      return;
    }

    if (this.isShowingModal) {
      this.modalQueue.push({ name: modalName, data, onClose });
      return;
    }

    this.isShowingModal = true;
    this.repositionToCanvas();

    const prefab = this.getPrefabByName(modalName);
    if (!prefab) {
      this.isShowingModal = false;
      this.processQueue();
      return;
    }

    const modalNode = instantiate(prefab);
    modalNode.setParent(this.modalContainer);

    this.activeModals.set(modalName, modalNode);

    const modalComponent = modalNode.getComponent(BaseModal);
    if (modalComponent) {
      modalComponent.setData(data);
      modalComponent.show(() => {
        if (onClose) onClose();
        this.onModalClosed(modalName);
      });
    } else {
      console.error(
        `[ModalManager] Modal ${modalName} does not have BaseModal component`
      );
      this.isShowingModal = false;
      this.processQueue();
    }
  }

  public closeModal(modalName: string): void {
    const modalNode = this.activeModals.get(modalName);
    if (modalNode && modalNode.isValid) {
      const modalComponent = modalNode.getComponent(BaseModal);
      if (modalComponent) {
        modalComponent.hide();
      } else {
        console.error(
          `[ModalManager] Modal ${modalName} does not have BaseModal component`
        );
        modalNode.destroy();
        this.activeModals.delete(modalName);
        this.onModalClosed(modalName);
      }
    }
  }

  public closeAllModals(): void {
    this.activeModals.forEach((modalNode, modalName) => {
      if (modalNode && modalNode.isValid) {
        modalNode.destroy();
      }
    });
    this.activeModals.clear();
    this.modalQueue = [];
    this.isShowingModal = false;
  }

  public isModalActive(modalName: string): boolean {
    return this.activeModals.has(modalName);
  }

  public isAnyModalActive(): boolean {
    return this.activeModals.size > 0;
  }

  private getPrefabByName(modalName: string): Prefab | null {
    switch (modalName) {
      case "WinModal":
        return this.winModalPrefab;
      case "PaytableModal":
        return this.paytableModalPrefab;
      case "SettingsModal":
        return this.settingsModalPrefab;
      default:
        return null;
    }
  }

  private onModalClosed(modalName: string): void {
    const modalNode = this.activeModals.get(modalName);
    if (modalNode && modalNode.isValid) {
      modalNode.destroy();
    }
    this.activeModals.delete(modalName);

    this.isShowingModal = false;
    this.processQueue();
  }

  private processQueue(): void {
    if (this.modalQueue.length > 0) {
      const next = this.modalQueue.shift();
      if (next) {
        this.showModal(next.name, next.data, next.onClose);
      }
    }
  }
}
