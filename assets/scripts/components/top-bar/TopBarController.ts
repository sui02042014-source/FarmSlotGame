import { _decorator, Button, Component, Node, Label, Color } from "cc";
import { SceneManager } from "../../core/scene-manager/SceneManager";
import { ModalManager } from "../modals/ModalManager";
import { GameManager } from "../../core/game-manager/GameManager";

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
    if (this.lobbyButton) {
      this.lobbyButton.off(
        Node.EventType.TOUCH_END,
        this.onLobbyButtonClick,
        this
      );
    }
    if (this.infoButton) {
      this.infoButton.off(
        Node.EventType.TOUCH_END,
        this.onInfoButtonClick,
        this
      );
    }
    if (this.settingsButton) {
      this.settingsButton.off(
        Node.EventType.TOUCH_END,
        this.onSettingsButtonClick,
        this
      );
    }
    if (this.pauseButton) {
      this.pauseButton.off(
        Node.EventType.TOUCH_END,
        this.onPauseButtonClick,
        this
      );
    }
  }

  private onLobbyButtonClick(): void {
    SceneManager.instance.loadLobbyScene();
  }

  private onInfoButtonClick(): void {
    const gameManager = GameManager.getInstance();
    if (gameManager) {
      gameManager.pauseGame();
      this.updatePauseButtonUI();
    }

    const modalManager = ModalManager.getInstance();
    if (modalManager) {
      modalManager.showPaytableModal(() => {
        if (gameManager) {
          gameManager.resumeGame();
          this.updatePauseButtonUI();
        }
      });
    }
  }

  private onSettingsButtonClick(): void {
    const gameManager = GameManager.getInstance();
    if (gameManager) {
      gameManager.pauseGame();
      this.updatePauseButtonUI();
    }

    const modalManager = ModalManager.getInstance();
    if (modalManager) {
      modalManager.showSettingsModal(() => {
        if (gameManager) {
          gameManager.resumeGame();
          this.updatePauseButtonUI();
        }
      });
    }
  }

  private onPauseButtonClick(): void {
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
    if (!this.pauseLabel) {
      return;
    }
    const gameManager = GameManager.getInstance();
    if (!gameManager) {
      this.scheduleOnce(() => this.updatePauseButtonUI(), 0.1);
      return;
    }
    const isPaused = gameManager.isGamePaused();
    const targetText = isPaused ? "RESUME" : "PAUSE";
    this.pauseLabel.string = targetText;
    this.pauseLabel.updateRenderData(true);
  }
}
