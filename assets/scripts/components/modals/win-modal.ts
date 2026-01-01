import { _decorator, Label, Node, tween, Vec3 } from "cc";
import { CoinRainEffect } from "../../utils/effects/coin-rain-effect";
import { NumberCounter } from "../../utils/helpers/number-counter";
import { BaseModal } from "./base-modal";
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;

const logger = Logger.create("WinModal");

const WIN_MODAL_CONSTANTS = {
  COUNTER_DURATION: 1.5,
  COUNTER_DECIMAL_PLACES: 2,
  AUTO_CLOSE_DELAY: 3.0,
  PULSE_SCALE_UP: 1.2,
  PULSE_SCALE_NORMAL: 1.0,
  PULSE_DURATION: 0.3,
  PULSE_REPEAT_COUNT: 3,
  COIN_RAIN_SPAWN_INTERVAL: 0.0085,
  COIN_RAIN_FALL_DURATION: 0.8,
} as const;

const CACHED_SCALES = {
  LARGE: new Vec3(
    WIN_MODAL_CONSTANTS.PULSE_SCALE_UP,
    WIN_MODAL_CONSTANTS.PULSE_SCALE_UP,
    1
  ),
  NORMAL: new Vec3(
    WIN_MODAL_CONSTANTS.PULSE_SCALE_NORMAL,
    WIN_MODAL_CONSTANTS.PULSE_SCALE_NORMAL,
    1
  ),
} as const;

interface WinModalData {
  winAmount?: number;
  betAmount?: number;
}

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
  private counter: NumberCounter | null = null;

  protected onLoad(): void {
    super.onLoad();
    this.initCounter();
  }

  private initCounter(): void {
    if (!this.winAmountLabel?.node) {
      logger.error("winAmountLabel not found");
      return;
    }

    this.counter =
      this.winAmountLabel.node.getComponent(NumberCounter) ||
      this.winAmountLabel.node.addComponent(NumberCounter);

    this.counter.label = this.winAmountLabel;
    this.counter.duration = WIN_MODAL_CONSTANTS.COUNTER_DURATION;
    this.counter.decimalPlaces = WIN_MODAL_CONSTANTS.COUNTER_DECIMAL_PLACES;
  }

  protected onDataSet(data: unknown): void {
    const winData = data as WinModalData;
    this.winAmount = winData?.winAmount || 0;
    this.betAmount = winData?.betAmount || 1;
    this.updateUI();
  }

  protected onAfterShow(): void {
    super.onAfterShow();
    this.startCounterAnimation();
    this.startPulseAnimation();
    this.playCoinRainEffect();
    this.scheduleAutoClose();
  }

  protected onBeforeHide(): void {
    super.onBeforeHide();
    this.cleanup();
  }

  private startCounterAnimation(): void {
    if (this.counter) {
      this.counter.setValue(0);
      this.counter.countTo(
        this.winAmount,
        WIN_MODAL_CONSTANTS.COUNTER_DURATION
      );
    }
  }

  private startPulseAnimation(): void {
    if (this.winAmountLabel?.node) {
      this.playPulseAnimation(this.winAmountLabel.node);
    }
  }

  private scheduleAutoClose(): void {
    this.scheduleOnce(() => this.hide(), WIN_MODAL_CONSTANTS.AUTO_CLOSE_DELAY);
  }

  private cleanup(): void {
    this.unscheduleAllCallbacks();
    CoinRainEffect.stop();
  }

  // ==========================================
  // UI Update
  // ==========================================

  private updateUI(): void {
    this.updateMultiplierLabel();
    this.updateWinAmountLabel();
  }

  private updateMultiplierLabel(): void {
    if (!this.winMultiplierLabel) return;

    const multiplier = this.calculateMultiplier();
    this.winMultiplierLabel.string = `${multiplier.toFixed(1)}x`;
  }

  private calculateMultiplier(): number {
    return this.betAmount > 0 ? this.winAmount / this.betAmount : 0;
  }

  private updateWinAmountLabel(): void {
    if (this.winAmountLabel && !this.counter) {
      this.winAmountLabel.string = this.winAmount.toFixed(2);
    }
  }

  // ==========================================
  // Animations
  // ==========================================

  private playPulseAnimation(targetNode: Node): void {
    tween(targetNode)
      .to(
        WIN_MODAL_CONSTANTS.PULSE_DURATION,
        { scale: CACHED_SCALES.LARGE },
        { easing: "sineOut" }
      )
      .to(
        WIN_MODAL_CONSTANTS.PULSE_DURATION,
        { scale: CACHED_SCALES.NORMAL },
        { easing: "sineIn" }
      )
      .union()
      .repeat(WIN_MODAL_CONSTANTS.PULSE_REPEAT_COUNT)
      .start();
  }

  private playCoinRainEffect(): void {
    if (!this.node?.isValid) {
      logger.error("Node not valid for coin rain effect");
      return;
    }

    CoinRainEffect.start({
      parent: this.node,
      asBackground: true,
      spawnInterval: WIN_MODAL_CONSTANTS.COIN_RAIN_SPAWN_INTERVAL,
      fallDuration: WIN_MODAL_CONSTANTS.COIN_RAIN_FALL_DURATION,
    });
  }

  // ==========================================
  // Event Handlers
  // ==========================================

  public onCollectButtonClick(): void {
    this.hide();
  }
}
