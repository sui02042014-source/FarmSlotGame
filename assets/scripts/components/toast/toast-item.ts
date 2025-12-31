import { _decorator, Component, Label, UIOpacity, Vec3, tween } from "cc";

const { ccclass, property } = _decorator;

@ccclass("ToastItem")
export class ToastItem extends Component {
  @property(Label)
  messageLabel: Label = null!;

  @property(UIOpacity)
  opacity: UIOpacity = null!;

  public show(message: string, duration: number = 2.0): void {
    if (this.messageLabel) {
      this.messageLabel.string = message;
    }

    this.node.setScale(new Vec3(0.5, 0.5, 1));
    if (this.opacity) this.opacity.opacity = 0;
    this.node.setPosition(new Vec3(0, 0, 0));

    tween(this.node)
      .to(0.3, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
      .start();

    if (this.opacity) {
      tween(this.opacity)
        .to(0.3, { opacity: 255 })
        .delay(duration)
        .to(0.5, { opacity: 0 })
        .call(() => {
          this.node.active = false;
        })
        .start();
    }

    tween(this.node.position)
      .by(duration + 0.8, new Vec3(0, 150, 0), { easing: "sineOut" })
      .start();
  }
}
