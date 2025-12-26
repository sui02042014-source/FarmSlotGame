import { _decorator, Button, Component, Node } from "cc";
import { SceneManager } from "../../core/scene-manager/SceneManager";

const { ccclass, property } = _decorator;

@ccclass("TopBarController")
export class TopBarController extends Component {
  @property(Node)
  lobbyButton: Node = null!;

  protected onLoad(): void {
    if (this.lobbyButton) {
      this.lobbyButton.on(
        Button.EventType.CLICK,
        this.onLobbyButtonClick,
        this
      );
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
  }

  private onLobbyButtonClick(): void {
    SceneManager.instance.loadLobbyScene();
  }
}
