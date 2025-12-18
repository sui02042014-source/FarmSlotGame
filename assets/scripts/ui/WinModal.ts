import { _decorator, Label, tween, Vec3 } from "cc";
import { BaseModal } from "./BaseModal";
import { NumberCounter } from "../utils/NumberCounter";
const { ccclass, property } = _decorator;

@ccclass("WinModal")
export class WinModal extends BaseModal {
  @property(Label)
  winAmountLabel: Label = null!;

  @property(Label)
  winMultiplierLabel: Label = null!;

  @property(Label)
  titleLabel: Label = null!;

  private winAmount: number = 0;
  private betAmount: number = 0;
  private winMultiplier: number = 0;
  private numberCounter: NumberCounter = null!;
  private readonly autoCloseDelaySec: number = 3.0;
  private readonly autoCloseCb = (): void => {
    this.hide();
  };

  protected onLoad(): void {
    super.onLoad();

    // Setup number counter for animated counting
    if (this.winAmountLabel) {
      this.numberCounter = this.winAmountLabel.node.getComponent(NumberCounter);
      if (!this.numberCounter) {
        this.numberCounter =
          this.winAmountLabel.node.addComponent(NumberCounter);
      }
      this.numberCounter.label = this.winAmountLabel;
      this.numberCounter.duration = 1.5;
      this.numberCounter.decimalPlaces = 2;
    }
  }

  protected onDataSet(data: any): void {
    this.winAmount = data.winAmount || 0;
    this.betAmount = data.betAmount || 1;
    this.winMultiplier =
      this.betAmount > 0 ? this.winAmount / this.betAmount : 0;

    this.updateUI();
  }

  protected onAfterShow(): void {
    super.onAfterShow();

    // Animate win amount counting up
    if (this.numberCounter) {
      this.numberCounter.setValue(0);
      this.numberCounter.countTo(this.winAmount, 1.5);
    }

    // Pulse animation on win amount
    if (this.winAmountLabel) {
      this.playPulseAnimation(this.winAmountLabel.node);
    }

    // Tự động đóng modal sau vài giây (và sẽ được unschedule khi modal đóng sớm)
    this.scheduleOnce(this.autoCloseCb, this.autoCloseDelaySec);
  }

  protected onBeforeHide(): void {
    // Nếu user đóng sớm, hủy auto-close để tránh gọi hide() lần 2
    this.unschedule(this.autoCloseCb);
    super.onBeforeHide();
  }

  /**
   * Update UI with win data
   */
  private updateUI(): void {
    // Set title based on win multiplier
    if (this.titleLabel) {
      if (this.winMultiplier >= 20) {
        this.titleLabel.string = "MEGA WIN!";
      } else if (this.winMultiplier >= 10) {
        this.titleLabel.string = "BIG WIN!";
      } else if (this.winMultiplier >= 5) {
        this.titleLabel.string = "GREAT WIN!";
      } else {
        this.titleLabel.string = "YOU WIN!";
      }
    }

    // Set win multiplier
    if (this.winMultiplierLabel) {
      this.winMultiplierLabel.string = `${this.winMultiplier.toFixed(1)}x`;
    }

    // Win amount will be animated by NumberCounter
    if (this.winAmountLabel && !this.numberCounter) {
      this.winAmountLabel.string = this.winAmount.toFixed(2);
    }
  }

  /**
   * Play pulse animation
   */
  private playPulseAnimation(node: any): void {
    const originalScale = node.scale.clone();
    const pulseScale = new Vec3(1.2, 1.2, 1);

    tween(node)
      .to(0.3, { scale: pulseScale }, { easing: "sineOut" })
      .to(0.3, { scale: originalScale }, { easing: "sineIn" })
      .union()
      .repeat(3)
      .start();
  }

  /**
   * Called when Collect button is clicked
   */
  public onCollectButtonClick(): void {
    this.hide();
  }
}
