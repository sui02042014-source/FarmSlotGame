import { _decorator, Component, Node, instantiate, Prefab } from "cc";
const { ccclass, property } = _decorator;

@ccclass("ModalManager")
export class ModalManager extends Component {
  @property(Node)
  modalContainer: Node = null!;

  @property(Prefab)
  winModalPrefab: Prefab = null!;

  @property(Prefab)
  notEnoughCoinsModalPrefab: Prefab = null!;

  @property(Prefab)
  settingsModalPrefab: Prefab = null!;

  private static instance: ModalManager = null!;
  private activeModals: Map<string, Node> = new Map();
  private modalQueue: Array<{ name: string; data: any }> = [];
  private isShowingModal: boolean = false;
  private readonly debugLogs: boolean = false;

  /**
   * Get singleton instance
   */
  public static getInstance(): ModalManager {
    return this.instance;
  }

  protected onLoad(): void {
    if (ModalManager.instance) {
      this.node.destroy();
      return;
    }
    ModalManager.instance = this;

    if (!this.modalContainer) {
      this.modalContainer = new Node("ModalContainer");
      this.modalContainer.setParent(this.node);
    }

    if (this.debugLogs) console.log("[ModalManager] Initialized");
  }

  protected onDestroy(): void {
    if (ModalManager.instance === this) {
      ModalManager.instance = null!;
    }
  }

  public getOverlayContainer(): Node {
    return this.modalContainer;
  }

  public showWinModal(winAmount: number, betAmount: number): void {
    this.showModal("WinModal", { winAmount, betAmount });
  }

  public showNotEnoughCoinsModal(
    requiredAmount: number,
    currentAmount: number
  ): void {
    this.showModal("NotEnoughCoinsModal", { requiredAmount, currentAmount });
  }

  public showSettingsModal(): void {
    this.showModal("SettingsModal", {});
  }

  public showModal(modalName: string, data: any = {}): void {
    if (this.debugLogs) {
      console.log(`[ModalManager] Show modal: ${modalName}`, data);
    }

    if (this.isShowingModal) {
      this.modalQueue.push({ name: modalName, data });
      return;
    }

    this.isShowingModal = true;

    const prefab = this.getPrefabByName(modalName);
    if (!prefab) {
      console.warn(`[ModalManager] Prefab not found for modal: ${modalName}`);
      this.isShowingModal = false;
      this.processQueue();
      return;
    }

    const modalNode = instantiate(prefab);
    modalNode.setParent(this.modalContainer);

    this.activeModals.set(modalName, modalNode);

    const modalComponent = modalNode.getComponent("BaseModal") as any;
    if (modalComponent) {
      modalComponent.setData(data);
      modalComponent.show(() => {
        this.onModalClosed(modalName);
      });
    } else {
      console.warn(
        `[ModalManager] BaseModal component not found on: ${modalName}`
      );
      this.isShowingModal = false;
      this.processQueue();
    }
  }

  public closeModal(modalName: string): void {
    const modalNode = this.activeModals.get(modalName);
    if (modalNode && modalNode.isValid) {
      const modalComponent = modalNode.getComponent("BaseModal") as any;
      if (modalComponent) {
        modalComponent.hide();
      } else {
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
      case "NotEnoughCoinsModal":
        return this.notEnoughCoinsModalPrefab;
      case "SettingsModal":
        return this.settingsModalPrefab;
      default:
        return null;
    }
  }

  private onModalClosed(modalName: string): void {
    if (this.debugLogs) {
      console.log(`[ModalManager] Modal closed: ${modalName}`);
    }

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
        this.showModal(next.name, next.data);
      }
    }
  }
}
