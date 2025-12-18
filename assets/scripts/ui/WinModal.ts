import { _decorator, Label, tween, Vec3 } from "cc";
import { BaseModal } from "./BaseModal";
import { NumberCounter } from "../utils/NumberCounter";
import { CoinFlyEffect } from "../utils/CoinFlyEffect";
import { GameManager } from "../game/GameManager";
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

    // Coin burst + fly into TopBar coin amount
    this.playCoinBurstToTopBar();

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

  private playCoinBurstToTopBar(): void {
    const gm = GameManager.getInstance();
    const target = gm?.coinIconNode?.isValid
      ? gm.coinIconNode
      : gm?.coinLabel?.node;
    const from = this.winAmountLabel?.node ?? this.modalContent ?? this.node;
    const parent = this.node.parent ?? this.node;
    if (
      !target ||
      !target.isValid ||
      !from ||
      !from.isValid ||
      !parent.isValid
    ) {
      return;
    }

    CoinFlyEffect.play({
      parent,
      fromNode: from,
      toNode: target,
      coinCount: 22,
      scatterRadius: 220,
      scatterDuration: 0.22,
      flyDuration: 0.65,
      stagger: 0.02,
      coinSize: 42,
      coinScale: 0.75,
      spriteFramePath: "win/coin_icon/spriteFrame",
      onAllArrive: () => {
        // Small "impact" pulse on the coin label when coins arrive
        const s0 = target.scale.clone();
        tween(target)
          .to(0.08, { scale: new Vec3(s0.x * 1.12, s0.y * 1.12, 1) })
          .to(0.12, { scale: s0 })
          .start();
      },
    });
  }
}
