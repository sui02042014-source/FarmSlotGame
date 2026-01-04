import { _decorator, Component, Label, Node } from "cc";
import { GameManager } from "../../core/game/game-manager";
import { SceneManager } from "../../core/scenes/scene-manager";
import { ModalManager } from "../modals/modal-manager";
import { ToastManager } from "../toast/toast-manager";
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;

const logger = Logger.create("TopBarController");

const TOP_BAR_CONSTANTS = {
  CLICK_DEBOUNCE: 200,
  MAX_RETRY_COUNT: 50,
  RETRY_INTERVAL: 0.1,
  TOAST_WAIT_MESSAGE: "Please wait for spin to complete!",
  PAUSE_LABEL_TEXT: "PAUSE",
  RESUME_LABEL_TEXT: "RESUME",
  TURBO_ON_TEXT: "TURBO ON",
  TURBO_OFF_TEXT: "TURBO OFF",
} as const;

@ccclass("TopBarController")
export class TopBarController extends Component {
  @property(Node)
  lobbyButton: Node = null!;

  @property(Node)
  infoButton: Node = null!;

  @property(Node)
  settingsButton: Node = null!;

  @property(Node)
  pauseButton: Node = null!;

  @property(Label)
  pauseLabel: Label = null!;

  @property(Node)
  turboButton: Node = null!;

  @property(Label)
  turboLabel: Label = null!;

  private lastClickTime: number = 0;
  private retryCount: number = 0;

  private get gameManager(): GameManager | null {
    return GameManager.getInstance();
  }

  private get modalManager(): ModalManager | null {
    return ModalManager.getInstance();
  }

  private get toastManager(): ToastManager | null {
    return ToastManager.getInstance();
  }

  protected onLoad(): void {
    this.setupEventListeners();
  }

  protected start(): void {
    this.updatePauseButtonUI();
    this.updateTurboButtonUI();
  }

  private setupEventListeners(): void {
    this.registerButtonEvent(this.lobbyButton, this.onLobbyButtonClick);
    this.registerButtonEvent(this.infoButton, this.onInfoButtonClick);
    this.registerButtonEvent(this.settingsButton, this.onSettingsButtonClick);
    this.registerButtonEvent(this.pauseButton, this.onPauseButtonClick);
    this.registerButtonEvent(this.turboButton, this.onTurboButtonClick);
  }

  private registerButtonEvent(button: Node, handler: () => void): void {
    if (button?.isValid) {
      button.on(Node.EventType.TOUCH_END, handler, this);
    }
  }

  protected onDestroy(): void {
    this.cleanupEventListeners();
  }

  private cleanupEventListeners(): void {
    this.unregisterButtonEvent(this.lobbyButton, this.onLobbyButtonClick);
    this.unregisterButtonEvent(this.infoButton, this.onInfoButtonClick);
    this.unregisterButtonEvent(this.settingsButton, this.onSettingsButtonClick);
    this.unregisterButtonEvent(this.pauseButton, this.onPauseButtonClick);
    this.unregisterButtonEvent(this.turboButton, this.onTurboButtonClick);
  }

  private unregisterButtonEvent(button: Node, handler: () => void): void {
    if (button?.isValid) {
      button.off(Node.EventType.TOUCH_END, handler, this);
    }
  }

  // ==========================================
  // Button Click Handlers
  // ==========================================

  private onLobbyButtonClick(): void {
    if (this.isGameBusy()) {
      this.toastManager?.show(TOP_BAR_CONSTANTS.TOAST_WAIT_MESSAGE);
      return;
    }

    SceneManager.instance.loadLobbyScene();
  }

  private isGameBusy(): boolean {
    return this.gameManager !== null && !this.gameManager.isIdle();
  }

  private onInfoButtonClick(): void {
    if (!this.modalManager || !this.gameManager) {
      return;
    }

    const currentBet = this.gameManager.getCurrentBet();
    this.modalManager.showPaytableModal(currentBet);
  }

  private onSettingsButtonClick(): void {
    if (!this.modalManager) {
      return;
    }

    this.modalManager.showSettingsModal();
  }

  private onPauseButtonClick(): void {
    if (!this.canHandleClick()) return;
    if (!this.gameManager) return;

    this.togglePauseState();
    this.updatePauseButtonUI();
  }

  private canHandleClick(): boolean {
    const now = Date.now();
    if (now - this.lastClickTime < TOP_BAR_CONSTANTS.CLICK_DEBOUNCE) {
      return false;
    }
    this.lastClickTime = now;
    return true;
  }

  private togglePauseState(): void {
    if (this.gameManager!.isGamePaused()) {
      this.gameManager!.resumeGame();
    } else {
      this.gameManager!.pauseGame();
    }
  }

  // ==========================================
  // Pause Button UI
  // ==========================================

  private updatePauseButtonUI(): void {
    if (!this.gameManager) {
      this.retryUpdatePauseButtonUI();
      return;
    }

    this.retryCount = 0;
    this.updatePauseLabel();
  }

  private retryUpdatePauseButtonUI(): void {
    if (this.retryCount < TOP_BAR_CONSTANTS.MAX_RETRY_COUNT) {
      this.retryCount++;
      this.scheduleOnce(
        () => this.updatePauseButtonUI(),
        TOP_BAR_CONSTANTS.RETRY_INTERVAL
      );
    } else {
      logger.error("GameManager not available after max retries");
    }
  }

  private updatePauseLabel(): void {
    if (!this.pauseLabel) return;

    const isPaused = this.gameManager!.isGamePaused();
    this.pauseLabel.string = isPaused
      ? TOP_BAR_CONSTANTS.RESUME_LABEL_TEXT
      : TOP_BAR_CONSTANTS.PAUSE_LABEL_TEXT;
    this.pauseLabel.updateRenderData(true);
  }

  // ==========================================
  // Turbo Button
  // ==========================================

  private onTurboButtonClick(): void {
    if (!this.canHandleClick()) return;
    if (!this.gameManager) return;

    this.gameManager.toggleTurboMode();
    this.updateTurboButtonUI();
  }

  private updateTurboButtonUI(): void {
    if (!this.turboLabel || !this.gameManager) return;

    const isTurbo = this.gameManager.isTurbo();
    this.turboLabel.string = isTurbo
      ? TOP_BAR_CONSTANTS.TURBO_ON_TEXT
      : TOP_BAR_CONSTANTS.TURBO_OFF_TEXT;

    this.turboLabel.updateRenderData(true);
  }
}
