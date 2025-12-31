import { _decorator, Label, tween, Vec3 } from "cc";
import { CoinRainEffect } from "../../utils/effects/coin-rain-effect";
import { NumberCounter } from "../../utils/helpers/number-counter";
import { BaseModal } from "./base-modal";

const { ccclass, property } = _decorator;

@ccclass("WinModal")
export class WinModal extends BaseModal {
  @property(Label) winAmountLabel: Label = null!;
  @property(Label) winMultiplierLabel: Label = null!;
  @property(Label) titleLabel: Label = null!;

  private _winAmount: number = 0;
  private _betAmount: number = 0;
  private _counter: NumberCounter = null!;
  private readonly AUTO_CLOSE_DELAY: number = 3.0;

  protected onLoad(): void {
    super.onLoad();
    this.initCounter();
  }

  private initCounter(): void {
    if (!this.winAmountLabel) return;
    this._counter =
      this.winAmountLabel.node.getComponent(NumberCounter) ||
      this.winAmountLabel.node.addComponent(NumberCounter);
    this._counter.label = this.winAmountLabel;
    this._counter.duration = 1.5;
    this._counter.decimalPlaces = 2;
  }

  protected onDataSet(data: any): void {
    this._winAmount = data.winAmount || 0;
    this._betAmount = data.betAmount || 1;
    this.updateUI();
  }

  protected onAfterShow(): void {
    super.onAfterShow();

    if (this._counter) {
      this._counter.setValue(0);
      this._counter.countTo(this._winAmount, 1.5);
    }

    if (this.winAmountLabel) {
      this.playPulseAnimation(this.winAmountLabel.node);
    }

    this.playCoinRainEffect();
    this.scheduleOnce(() => this.hide(), this.AUTO_CLOSE_DELAY);
  }

  protected onBeforeHide(): void {
    this.unscheduleAllCallbacks();
    CoinRainEffect.stop();
    super.onBeforeHide();
  }

  private updateUI(): void {
    if (this.winMultiplierLabel) {
      const multiplier =
        this._betAmount > 0 ? this._winAmount / this._betAmount : 0;
      this.winMultiplierLabel.string = `${multiplier.toFixed(1)}x`;
    }

    if (this.winAmountLabel && !this._counter) {
      this.winAmountLabel.string = this._winAmount.toFixed(2);
    }
  }

  private playPulseAnimation(targetNode: any): void {
    tween(targetNode)
      .to(0.3, { scale: new Vec3(1.2, 1.2, 1) }, { easing: "sineOut" })
      .to(0.3, { scale: new Vec3(1.0, 1.0, 1) }, { easing: "sineIn" })
      .union()
      .repeat(3)
      .start();
  }

  public onCollectButtonClick(): void {
    this.hide();
  }

  private playCoinRainEffect(): void {
    const parent = this.node;

    if (!parent?.isValid) return;

    CoinRainEffect.start({
      parent: parent,
      asBackground: true,
      spawnInterval: 0.0085,
      fallDuration: 0.8,
    });
  }
}
