import { _decorator, Component, Node, instantiate, Prefab } from "cc";
const { ccclass, property } = _decorator;

/**
 * Modal Manager - Quản lý tất cả các modal trong game
 * Đặt script này vào một node singleton (ví dụ: Canvas)
 */
@ccclass("ModalManager")
export class ModalManager extends Component {
  @property(Node)
  modalContainer: Node = null!; // Container để chứa các modal

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

    // Create modal container if not assigned
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

  /**
   * Show Win Modal
   */
  public showWinModal(winAmount: number, betAmount: number): void {
    this.showModal("WinModal", { winAmount, betAmount });
  }

  /**
   * Show Not Enough Coins Modal
   */
  public showNotEnoughCoinsModal(
    requiredAmount: number,
    currentAmount: number
  ): void {
    this.showModal("NotEnoughCoinsModal", { requiredAmount, currentAmount });
  }

  /**
   * Show Settings Modal
   */
  public showSettingsModal(): void {
    this.showModal("SettingsModal", {});
  }

  /**
   * Show a modal by name
   */
  public showModal(modalName: string, data: any = {}): void {
    if (this.debugLogs) {
      console.log(`[ModalManager] Show modal: ${modalName}`, data);
    }

    // Add to queue if another modal is showing
    if (this.isShowingModal) {
      this.modalQueue.push({ name: modalName, data });
      return;
    }

    this.isShowingModal = true;

    // Get the appropriate prefab
    const prefab = this.getPrefabByName(modalName);
    if (!prefab) {
      console.warn(`[ModalManager] Prefab not found for modal: ${modalName}`);
      this.isShowingModal = false;
      this.processQueue();
      return;
    }

    // Instantiate modal
    const modalNode = instantiate(prefab);
    modalNode.setParent(this.modalContainer);

    // Store active modal
    this.activeModals.set(modalName, modalNode);

    // Get modal component and initialize with data
    const modalComponent = modalNode.getComponent("BaseModal") as any;
    if (modalComponent) {
      modalComponent.setData(data);
      modalComponent.show(() => {
        // Callback when modal is closed
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

  /**
   * Close a modal by name
   */
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

  /**
   * Close all modals
   */
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

  /**
   * Check if a modal is currently showing
   */
  public isModalActive(modalName: string): boolean {
    return this.activeModals.has(modalName);
  }

  /**
   * Check if any modal is showing
   */
  public isAnyModalActive(): boolean {
    return this.activeModals.size > 0;
  }

  /**
   * Get prefab by modal name
   */
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

  /**
   * Called when a modal is closed
   */
  private onModalClosed(modalName: string): void {
    if (this.debugLogs) {
      console.log(`[ModalManager] Modal closed: ${modalName}`);
    }

    // Remove from active modals
    const modalNode = this.activeModals.get(modalName);
    if (modalNode && modalNode.isValid) {
      modalNode.destroy();
    }
    this.activeModals.delete(modalName);

    // Reset flag and process queue
    this.isShowingModal = false;
    this.processQueue();
  }

  /**
   * Process modal queue
   */
  private processQueue(): void {
    if (this.modalQueue.length > 0) {
      const next = this.modalQueue.shift();
      if (next) {
        this.showModal(next.name, next.data);
      }
    }
  }
}
