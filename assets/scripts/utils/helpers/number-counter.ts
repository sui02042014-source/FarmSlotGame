import { _decorator, CCInteger, Component, Label, tween, Tween } from "cc";
const { ccclass, property } = _decorator;

const COUNTER_CONSTANTS = {
  EASING: "sineOut",
} as const;

interface TweenTarget {
  value: number;
}

@ccclass("NumberCounter")
export class NumberCounter extends Component {
  @property(Label)
  label: Label = null!;

  @property
  duration: number = 2.0;

  @property({ type: CCInteger })
  decimalPlaces: number = 2;

  @property
  useThousandSeparator: boolean = true;

  @property
  prefix: string = "";

  @property
  suffix: string = "";

  @property
  public currentValue: number = 0;

  private targetValue: number = 0;
  private activeTween: Tween<TweenTarget> | null = null;

  // ==========================================
  // Public API
  // ==========================================

  public countTo(target: number, duration?: number): Promise<void> {
    return new Promise((resolve) => {
      this.targetValue = target;
      const animDuration = duration ?? this.duration;

      this.stopCurrentAnimation();

      if (animDuration <= 0) {
        this.setValue(target);
        return resolve();
      }

      this.startCountAnimation(target, animDuration, resolve);
    });
  }

  public setValue(value: number): void {
    this.stopCurrentAnimation();
    this.currentValue = value;
    this.targetValue = value;
    this.updateLabel();
  }

  public addValue(amount: number, duration?: number): Promise<void> {
    return this.countTo(this.targetValue + amount, duration);
  }

  public subtractValue(amount: number, duration?: number): Promise<void> {
    return this.countTo(this.targetValue - amount, duration);
  }

  // ==========================================
  // Animation
  // ==========================================

  private startCountAnimation(
    target: number,
    duration: number,
    onComplete: () => void
  ): void {
    const tweenObject: TweenTarget = { value: this.currentValue };

    this.activeTween = tween(tweenObject)
      .to(
        duration,
        { value: target },
        {
          easing: COUNTER_CONSTANTS.EASING,
          onUpdate: () => {
            this.currentValue = tweenObject.value;
            this.updateLabel();
          },
        }
      )
      .call(() => {
        this.activeTween = null;
        this.currentValue = target;
        this.updateLabel();
        onComplete();
      })
      .start();
  }

  private stopCurrentAnimation(): void {
    if (this.activeTween) {
      this.activeTween.stop();
      this.activeTween = null;
    }
  }

  // ==========================================
  // Label Update & Formatting
  // ==========================================

  private updateLabel(): void {
    if (!this.label?.isValid) return;

    const formatted = this.formatNumber(this.currentValue);
    this.label.string = `${this.prefix}${formatted}${this.suffix}`;
  }

  private formatNumber(value: number): string {
    let numStr = value.toFixed(this.decimalPlaces);

    if (this.useThousandSeparator) {
      numStr = this.addThousandSeparators(numStr);
    }

    return numStr;
  }

  private addThousandSeparators(numStr: string): string {
    const parts = numStr.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return parts.join(".");
  }

  // ==========================================
  // Lifecycle
  // ==========================================

  protected onDestroy(): void {
    this.stopCurrentAnimation();
  }
}
