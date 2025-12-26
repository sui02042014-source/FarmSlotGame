import { _decorator, Label, tween, Vec3 } from "cc";
import { BaseModal } from "./BaseModal";
import { NumberCounter } from "../../utils/helpers/NumberCounter";
import { CoinFlyEffect } from "../../utils/effects/CoinFlyEffect";
import { GameManager } from "../../core/game-manager/GameManager";

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

    this.playCoinBurstEffect();
    this.scheduleOnce(() => this.hide(), this.AUTO_CLOSE_DELAY);
  }

  protected onBeforeHide(): void {
    this.unscheduleAllCallbacks();
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

  private playCoinBurstEffect(): void {
    const gm = GameManager.getInstance();
    const target = gm?.coinIconNode || gm?.coinLabel?.node;
    const from = this.winAmountLabel?.node || this.modalContent || this.node;
    const canvas = this.node.scene?.getChildByName("Canvas");

    if (!target?.isValid || !from?.isValid || !canvas?.isValid) return;

    CoinFlyEffect.play({
      parent: canvas,
      fromNode: from,
      toNode: target,
      coinCount: 22,
      scatterRadius: 220,
      coinSize: 60,
      onAllArrive: () => {
        tween(target)
          .to(0.1, { scale: new Vec3(1.15, 1.15, 1) })
          .to(0.1, { scale: new Vec3(1.0, 1.0, 1) })
          .start();
      },
    });
  }
}
