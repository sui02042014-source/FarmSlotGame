import { _decorator, Component, Node, instantiate, Prefab, Widget } from "cc";
import { BaseModal } from "./BaseModal";

const { ccclass, property } = _decorator;

export enum ModalType {
  WIN = "WinModal",
  NOT_ENOUGH_COINS = "NotEnoughCoinsModal",
  SETTINGS = "SettingsModal",
}

interface ModalQueueItem {
  type: ModalType;
  data: any;
}

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

  private static _instance: ModalManager = null!;
  private _activeModals = new Map<ModalType, Node>();
  private _modalQueue: ModalQueueItem[] = [];
  private _isShowingModal: boolean = false;
  private _prefabMap = new Map<ModalType, Prefab>();

  public static getInstance(): ModalManager {
    return this._instance;
  }

  protected onLoad(): void {
    if (ModalManager._instance) {
      this.node.destroy();
      return;
    }
    ModalManager._instance = this;

    this.initPrefabMap();
    this.ensureContainer();
  }

  private initPrefabMap(): void {
    this._prefabMap.set(ModalType.WIN, this.winModalPrefab);
    this._prefabMap.set(
      ModalType.NOT_ENOUGH_COINS,
      this.notEnoughCoinsModalPrefab
    );
    this._prefabMap.set(ModalType.SETTINGS, this.settingsModalPrefab);
  }

  private ensureContainer(): void {
    if (!this.modalContainer) {
      this.modalContainer = new Node("ModalContainer");
      this.modalContainer.setParent(this.node);
      const widget = this.modalContainer.addComponent(Widget);
      widget.isAlignTop =
        widget.isAlignBottom =
        widget.isAlignLeft =
        widget.isAlignRight =
          true;
      widget.top = widget.bottom = widget.left = widget.right = 0;
    }
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  public showWinModal(winAmount: number, betAmount: number): void {
    this.showModal(ModalType.WIN, { winAmount, betAmount });
  }

  public showNotEnoughCoinsModal(required: number, current: number): void {
    this.showModal(ModalType.NOT_ENOUGH_COINS, {
      requiredAmount: required,
      currentAmount: current,
    });
  }

  public showSettingsModal(): void {
    this.showModal(ModalType.SETTINGS);
  }

  public showModal(type: ModalType, data: any = {}): void {
    if (this._isShowingModal) {
      this._modalQueue.push({ type, data });
      return;
    }

    const prefab = this._prefabMap.get(type);
    if (!prefab) {
      console.error(`[ModalManager] Prefab not found for: ${type}`);
      this.processQueue();
      return;
    }

    this._isShowingModal = true;
    const modalNode = instantiate(prefab);
    modalNode.setParent(this.modalContainer);
    this._activeModals.set(type, modalNode);

    const modalComp = modalNode.getComponent(BaseModal);
    if (modalComp) {
      modalComp.setData(data);
      modalComp.show(() => this.onModalClosed(type));
    } else {
      console.error(`[ModalManager] Node ${type} missing BaseModal component`);
      this.onModalClosed(type);
    }
  }

  public closeModal(type: ModalType): void {
    const modalNode = this._activeModals.get(type);
    if (modalNode?.isValid) {
      const comp = modalNode.getComponent(BaseModal);
      comp ? comp.hide() : this.onModalClosed(type);
    }
  }

  public closeAllModals(): void {
    this._activeModals.forEach((node) => node.isValid && node.destroy());
    this._activeModals.clear();
    this._modalQueue = [];
    this._isShowingModal = false;
  }

  public isAnyModalActive(): boolean {
    return this._activeModals.size > 0 || this._isShowingModal;
  }

  public getOverlayContainer(): Node {
    return this.modalContainer;
  }

  // ==========================================
  // PRIVATE LOGIC
  // ==========================================

  private onModalClosed(type: ModalType): void {
    const node = this._activeModals.get(type);
    if (node?.isValid) node.destroy();

    this._activeModals.delete(type);
    this._isShowingModal = false;

    this.processQueue();
  }

  private processQueue(): void {
    if (this._modalQueue.length > 0) {
      const next = this._modalQueue.shift();
      if (next) this.showModal(next.type, next.data);
    }
  }

  protected onDestroy(): void {
    if (ModalManager._instance === this) ModalManager._instance = null!;
  }
}
