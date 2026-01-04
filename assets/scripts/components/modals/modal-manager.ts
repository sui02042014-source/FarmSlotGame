import { _decorator, Component, Node, instantiate, Prefab, game } from "cc";
import { BaseModal } from "./base-modal";
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;

const logger = Logger.create("ModalManager");

const MODAL_CONSTANTS = {
  CANVAS_COMPONENT: "cc.Canvas",
  CONTAINER_NAME: "ModalContainer",
} as const;

export const ModalNames = {
  WIN: "WinModal",
  PAYTABLE: "PaytableModal",
  SETTINGS: "SettingsModal",
} as const;

export type ModalName = (typeof ModalNames)[keyof typeof ModalNames];

interface ModalQueueItem {
  name: string;
  data: unknown;
  onClose?: () => void;
}

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
  private activeModals = new Map<string, Node>();
  private modalQueue: ModalQueueItem[] = [];
  private isShowingModal: boolean = false;
  private prefabMap!: Map<string, Prefab>;

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
    this.initializePrefabMap();
    this.persistNodeIfNeeded();
    this.ensureModalContainer();
    this.repositionToCanvas();
  }

  private initializePrefabMap(): void {
    this.prefabMap = new Map([
      [ModalNames.WIN, this.winModalPrefab],
      [ModalNames.PAYTABLE, this.paytableModalPrefab],
      [ModalNames.SETTINGS, this.settingsModalPrefab],
    ]);
  }

  private persistNodeIfNeeded(): void {
    if (this.node.parent && this.node.parent === this.node.scene) {
      game.addPersistRootNode(this.node);
    }
  }

  private ensureModalContainer(): void {
    if (!this.modalContainer) {
      this.modalContainer = new Node(MODAL_CONSTANTS.CONTAINER_NAME);
      this.modalContainer.setParent(this.node);
    }
  }

  private repositionToCanvas(): void {
    if (!this.node?.isValid || !this.node.scene) return;

    const canvas = this.node.scene.getComponentInChildren(
      MODAL_CONSTANTS.CANVAS_COMPONENT
    )?.node;

    if (canvas && this.node.parent !== canvas) {
      this.node.setParent(canvas);
      this.node.setSiblingIndex(this.node.parent!.children.length - 1);
    }
  }

  public getOverlayContainer(): Node {
    return this.modalContainer;
  }

  // ==========================================
  // Public API - Show Modals
  // ==========================================

  public showWinModal(
    winAmount: number,
    betAmount: number,
    onClose?: () => void
  ): void {
    this.showModal(ModalNames.WIN, { winAmount, betAmount }, onClose);
  }

  public showPaytableModal(currentBet: number, onClose?: () => void): void {
    this.showModal(ModalNames.PAYTABLE, { currentBet }, onClose);
  }

  public showSettingsModal(onClose?: () => void): void {
    this.showModal(ModalNames.SETTINGS, {}, onClose);
  }

  public showModal(
    modalName: string,
    data: unknown = {},
    onClose?: () => void
  ): void {
    if (this.isModalAlreadyQueued(modalName)) return;

    if (this.isShowingModal) {
      this.modalQueue.push({ name: modalName, data, onClose });
      return;
    }

    this.displayModal(modalName, data, onClose);
  }

  private isModalAlreadyQueued(modalName: string): boolean {
    return (
      this.isModalActive(modalName) ||
      this.modalQueue.some((m) => m.name === modalName)
    );
  }

  private displayModal(
    modalName: string,
    data: unknown,
    onClose?: () => void
  ): void {
    this.isShowingModal = true;
    this.repositionToCanvas();

    const prefab = this.getPrefabByName(modalName);
    if (!prefab) {
      logger.error(`Prefab not found for modal: ${modalName}`);
      this.resetShowingState();
      return;
    }

    const modalNode = instantiate(prefab);
    modalNode.setParent(this.modalContainer);
    this.activeModals.set(modalName, modalNode);

    const modalComponent = modalNode.getComponent(BaseModal);
    if (!modalComponent) {
      this.handleMissingComponent(modalName, modalNode);
      return;
    }

    modalComponent.setData(data);
    modalComponent.show(() => {
      onClose?.();
      this.onModalClosed(modalName);
    });
  }

  private handleMissingComponent(modalName: string, modalNode: Node): void {
    logger.error(`Modal ${modalName} does not have BaseModal component`);
    modalNode.destroy();
    this.activeModals.delete(modalName);
    this.resetShowingState();
  }

  private resetShowingState(): void {
    this.isShowingModal = false;
    this.processQueue();
  }

  // ==========================================
  // Public API - Close Modals
  // ==========================================

  public closeModal(modalName: string): void {
    const modalNode = this.activeModals.get(modalName);
    if (!modalNode?.isValid) return;

    const modalComponent = modalNode.getComponent(BaseModal);
    if (modalComponent) {
      modalComponent.hide();
    } else {
      logger.error(`Modal ${modalName} does not have BaseModal component`);
      this.forceCloseModal(modalName, modalNode);
    }
  }

  public closeAllModals(): void {
    this.activeModals.forEach((modalNode, modalName) => {
      if (modalNode?.isValid) {
        const modalComponent = modalNode.getComponent(BaseModal);
        if (modalComponent) {
          modalComponent.hide();
        } else {
          modalNode.destroy();
        }
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

  // ==========================================
  // Private Helpers
  // ==========================================

  private getPrefabByName(modalName: string): Prefab | null {
    return this.prefabMap.get(modalName) || null;
  }

  private forceCloseModal(modalName: string, modalNode: Node): void {
    modalNode.destroy();
    this.activeModals.delete(modalName);
    this.onModalClosed(modalName);
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
