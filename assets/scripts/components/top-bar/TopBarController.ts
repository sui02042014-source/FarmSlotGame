import { _decorator, Button, Component, Node } from "cc";
import { SceneManager } from "../../core/scene-manager/SceneManager";
import { ModalManager } from "../modals/ModalManager";

const { ccclass, property } = _decorator;

@ccclass("TopBarController")
export class TopBarController extends Component {
  @property(Node)
  lobbyButton: Node = null!;

  @property(Node)
  infoButton: Node = null!;

  protected onLoad(): void {
    if (this.lobbyButton) {
      this.lobbyButton.on(
        Button.EventType.CLICK,
        this.onLobbyButtonClick,
        this
      );
    }

    if (this.infoButton) {
      this.infoButton.on(Button.EventType.CLICK, this.onInfoButtonClick, this);
    }
  }

  protected onDestroy(): void {
    if (this.lobbyButton?.isValid) {
      this.lobbyButton.off(
        Button.EventType.CLICK,
        this.onLobbyButtonClick,
        this
      );
    }

    if (this.infoButton?.isValid) {
      this.infoButton.off(Button.EventType.CLICK, this.onInfoButtonClick, this);
    }
  }

  private onLobbyButtonClick(): void {
    SceneManager.instance.loadLobbyScene();
  }

  private onInfoButtonClick(): void {
    const modalManager = ModalManager.getInstance();
    if (modalManager) {
      modalManager.showPaytableModal();
    }
  }
}
