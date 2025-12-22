import { _decorator, Component, Label, tween, Tween } from "cc";
const { ccclass, property } = _decorator;

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

  public countTo(target: number, duration?: number): Promise<void> {
    return new Promise((resolve) => {
      this.targetValue = target;
      const animDuration = duration !== undefined ? duration : this.duration;
      const startValue = this.currentValue;

      if (this.isAnimating) {
        Tween.stopAllByTarget(this);
      }

      this.isAnimating = true;

      const progress = { value: 0 };
      tween(progress)
        .to(
          animDuration,
          { value: 1 },
          {
            onUpdate: () => {
              this.currentValue =
                startValue + (target - startValue) * progress.value;
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

  public setValue(value: number): void {
    if (this.isAnimating) {
      Tween.stopAllByTarget(this);
      this.isAnimating = false;
    }

    this.currentValue = value;
    this.targetValue = value;
    this.updateLabel();
  }

  private updateLabel(): void {
    if (!this.label) return;

    const formatted = this.formatNumber(this.currentValue);
    this.label.string = `${this.prefix}${formatted}${this.suffix}`;
  }

  private formatNumber(value: number): string {
    return value.toFixed(this.decimalPlaces);
  }

  public getCurrentValue(): number {
    return this.currentValue;
  }

  public addValue(amount: number, duration?: number): Promise<void> {
    return this.countTo(this.currentValue + amount, duration);
  }

  public subtractValue(amount: number, duration?: number): Promise<void> {
    return this.countTo(this.currentValue - amount, duration);
  }
}
