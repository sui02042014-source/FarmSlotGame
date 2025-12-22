import { _decorator, Component, Button } from "cc";
import { ModalManager } from "./ModalManager";
const { ccclass, property } = _decorator;

@ccclass("ModalButton")
export class ModalButton extends Component {
  @property({
    type: String,
    tooltip: "Name of the modal to open (WinModal, NotEnoughCoinsModal, SettingsModal, etc.)",
  })
  modalName: string = "";

  @property({
    tooltip: "Custom data to pass to modal (JSON string)",
  })
  customData: string = "{}";

  private button: Button = null!;

  protected onLoad(): void {
    this.button = this.node.getComponent(Button);
    if (!this.button) {
      console.warn("[ModalButton] No Button component found!");
      return;
    }

    this.node.on(Button.EventType.CLICK, this.onButtonClick, this);
  }

  protected onDestroy(): void {
    if (this.button) {
      this.node.off(Button.EventType.CLICK, this.onButtonClick, this);
    }
  }
  
  private onButtonClick(): void {
    if (!this.modalName) {
      console.warn("[ModalButton] No modal name specified!");
      return;
    }

    const modalManager = ModalManager.getInstance();
    if (!modalManager) {
      console.warn("[ModalButton] ModalManager not found!");
      return;
    }

    let data = {};
    try {
      data = JSON.parse(this.customData);
    } catch (error) {
      console.warn("[ModalButton] Invalid custom data JSON:", error);
    }

    modalManager.showModal(this.modalName, data);
  }
  
  public showModal(): void {
    this.onButtonClick();
  }
}
