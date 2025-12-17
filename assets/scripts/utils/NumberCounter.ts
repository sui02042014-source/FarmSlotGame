import { _decorator, Component, Label, tween, Tween } from "cc";
const { ccclass, property } = _decorator;

/**
 * Number Counter - Hiệu ứng đếm số từ A đến B
 * Dùng cho win amount, coin count, etc.
 */
@ccclass("NumberCounter")
export class NumberCounter extends Component {
  @property(Label)
  label: Label = null!;

  @property
  duration: number = 2.0;

  @property
  decimalPlaces: number = 2;

  @property
  prefix: string = "";

  @property
  suffix: string = "";

  private currentValue: number = 0;
  private targetValue: number = 0;
  private isAnimating: boolean = false;

  /**
   * Count from current to target value
   */
  public countTo(target: number, duration?: number): Promise<void> {
    return new Promise((resolve) => {
      this.targetValue = target;
      const animDuration = duration !== undefined ? duration : this.duration;

      if (this.isAnimating) {
        Tween.stopAllByTarget(this);
      }

      this.isAnimating = true;

      tween(this)
        .to(
          animDuration,
          { currentValue: target },
          {
            onUpdate: () => {
              this.updateLabel();
            },
          }
        )
        .call(() => {
          this.isAnimating = false;
          this.currentValue = target;
          this.updateLabel();
          resolve();
        })
        .start();
    });
  }

  /**
   * Set value immediately (no animation)
   */
  public setValue(value: number): void {
    if (this.isAnimating) {
      Tween.stopAllByTarget(this);
      this.isAnimating = false;
    }

    this.currentValue = value;
    this.targetValue = value;
    this.updateLabel();
  }

  /**
   * Update label text
   */
  private updateLabel(): void {
    if (!this.label) return;

    const formatted = this.formatNumber(this.currentValue);
    this.label.string = `${this.prefix}${formatted}${this.suffix}`;
  }

  /**
   * Format number với decimal places
   */
  private formatNumber(value: number): string {
    return value.toFixed(this.decimalPlaces);
  }

  /**
   * Get current value
   */
  public getCurrentValue(): number {
    return this.currentValue;
  }

  /**
   * Add value (animate)
   */
  public addValue(amount: number, duration?: number): Promise<void> {
    return this.countTo(this.currentValue + amount, duration);
  }

  /**
   * Subtract value (animate)
   */
  public subtractValue(amount: number, duration?: number): Promise<void> {
    return this.countTo(this.currentValue - amount, duration);
  }
}
