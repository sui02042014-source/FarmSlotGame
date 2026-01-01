import { _decorator, Component, Label, Node } from "cc";
import { GameManager } from "../../core/game/game-manager";
import { SceneManager } from "../../core/scenes/scene-manager";
import { ModalManager } from "../modals/modal-manager";
import { ToastManager } from "../toast/toast-manager";

const { ccclass, property } = _decorator;

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

  private _lastClickTime: number = 0;
  private readonly CLICK_DEBOUNCE = 200; // ms
  private _retryCount: number = 0;
  private readonly MAX_RETRY_COUNT = 50; // Max 5 seconds (50 * 0.1s)

  protected onLoad(): void {
    if (this.lobbyButton) {
      this.lobbyButton.on(
        Node.EventType.TOUCH_END,
        this.onLobbyButtonClick,
        this
      );
    }
    if (this.infoButton) {
      this.infoButton.on(
        Node.EventType.TOUCH_END,
        this.onInfoButtonClick,
        this
      );
    }
    if (this.settingsButton) {
      this.settingsButton.on(
        Node.EventType.TOUCH_END,
        this.onSettingsButtonClick,
        this
      );
    }
    if (this.pauseButton) {
      this.pauseButton.on(
        Node.EventType.TOUCH_END,
        this.onPauseButtonClick,
        this
      );
    }

    this.updatePauseButtonUI();
  }

  protected start(): void {
    this.updatePauseButtonUI();
  }

  protected onDestroy(): void {
    if (this.lobbyButton && this.lobbyButton.isValid) {
      this.lobbyButton.off(
        Node.EventType.TOUCH_END,
        this.onLobbyButtonClick,
        this
      );
    }
    if (this.infoButton && this.infoButton.isValid) {
      this.infoButton.off(
        Node.EventType.TOUCH_END,
        this.onInfoButtonClick,
        this
      );
    }
    if (this.settingsButton && this.settingsButton.isValid) {
      this.settingsButton.off(
        Node.EventType.TOUCH_END,
        this.onSettingsButtonClick,
        this
      );
    }
    if (this.pauseButton && this.pauseButton.isValid) {
      this.pauseButton.off(
        Node.EventType.TOUCH_END,
        this.onPauseButtonClick,
        this
      );
    }
  }

  private onLobbyButtonClick(): void {
    const gameManager = GameManager.getInstance();

    if (gameManager && !gameManager.isIdle()) {
      ToastManager.getInstance()?.show("Please wait for spin to complete!");
      return;
    }

    SceneManager.instance.loadLobbyScene();
  }

  private onInfoButtonClick(): void {
    const modalManager = ModalManager.getInstance();
    if (modalManager) {
      modalManager.showPaytableModal();
    }
  }

  private onSettingsButtonClick(): void {
    const modalManager = ModalManager.getInstance();
    if (modalManager) {
      modalManager.showSettingsModal();
    }
  }

  private onPauseButtonClick(): void {
    const now = Date.now();
    if (now - this._lastClickTime < this.CLICK_DEBOUNCE) return;
    this._lastClickTime = now;

    const gameManager = GameManager.getInstance();
    if (!gameManager) return;

    if (gameManager.isGamePaused()) {
      gameManager.resumeGame();
    } else {
      gameManager.pauseGame();
    }

    this.updatePauseButtonUI();
  }

  private updatePauseButtonUI(): void {
    const gameManager = GameManager.getInstance();
    if (!gameManager) {
      if (this._retryCount < this.MAX_RETRY_COUNT) {
        this._retryCount++;
        this.scheduleOnce(() => this.updatePauseButtonUI(), 0.1);
      } else {
        console.error(
          "[TopBarController] GameManager not available after max retries"
        );
      }
      return;
    }

    this._retryCount = 0; // Reset on success
    if (!this.pauseLabel) return;

    const isPaused = gameManager.isGamePaused();
    this.pauseLabel.string = isPaused ? "RESUME" : "PAUSE";
    this.pauseLabel.updateRenderData(true);
  }
}
