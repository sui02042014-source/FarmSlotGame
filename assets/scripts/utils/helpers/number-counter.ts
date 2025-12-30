import { _decorator, CCInteger, Component, Label, tween, Tween } from "cc";
const { ccclass, property } = _decorator;

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
  private _targetValue: number = 0;
  private _activeTween: Tween<any> | null = null;

  public countTo(target: number, duration?: number): Promise<void> {
    return new Promise((resolve) => {
      this._targetValue = target;
      const animDuration = duration ?? this.duration;

      this.stopCurrentAnimation();

      if (animDuration <= 0) {
        this.setValue(target);
        return resolve();
      }

      const tweenObject = { value: this.currentValue };
      this._activeTween = tween(tweenObject)
        .to(
          animDuration,
          { value: target },
          {
            easing: "sineOut",
            onUpdate: () => {
              this.currentValue = tweenObject.value;
              this.updateLabel();
            },
          }
        )
        .call(() => {
          this._activeTween = null;
          this.currentValue = target;
          this.updateLabel();
          resolve();
        })
        .start();
    });
  }

  public setValue(value: number): void {
    this.stopCurrentAnimation();
    this.currentValue = value;
    this._targetValue = value;
    this.updateLabel();
  }

  public addValue(amount: number, duration?: number): Promise<void> {
    return this.countTo(this._targetValue + amount, duration);
  }

  public subtractValue(amount: number, duration?: number): Promise<void> {
    return this.countTo(this._targetValue - amount, duration);
  }

  private stopCurrentAnimation(): void {
    if (this._activeTween) {
      this._activeTween.stop();
      this._activeTween = null;
    }
  }

  private updateLabel(): void {
    if (!this.label?.isValid) return;

    const formatted = this.formatNumber(this.currentValue);
    this.label.string = `${this.prefix}${formatted}${this.suffix}`;
  }

  private formatNumber(value: number): string {
    let numStr = value.toFixed(this.decimalPlaces);

    if (this.useThousandSeparator) {
      const parts = numStr.split(".");
      parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
      numStr = parts.join(".");
    }

    return numStr;
  }

  public getCurrentValue(): number {
    return this.currentValue;
  }

  public get targetValue(): number {
    return this._targetValue;
  }

  protected onDestroy(): void {
    this.stopCurrentAnimation();
  }
}
