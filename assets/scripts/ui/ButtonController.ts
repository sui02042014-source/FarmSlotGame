import {
  _decorator,
  Component,
  Node,
  Button,
  AudioSource,
  Vec3,
  tween,
} from "cc";
const { ccclass, property } = _decorator;

/**
 * Button Controller - Điều khiển button animations và sounds
 * Đặt script này vào các button nodes
 */
@ccclass("ButtonController")
export class ButtonController extends Component {
  @property
  scaleOnClick: boolean = true;

  @property
  clickScale: number = 0.95;

  @property
  scaleDuration: number = 0.1;

  @property
  enableSound: boolean = true;

  @property(AudioSource)
  audioSource: AudioSource = null!;

  private button: Button = null!;
  private originalScale: Vec3 = new Vec3(1, 1, 1);

  protected onLoad(): void {
    this.button = this.node.getComponent(Button);
    if (!this.button) {
      console.warn("[ButtonController] No Button component found!");
      return;
    }

    this.originalScale = this.node.scale.clone();

    // Register button events
    this.node.on(Button.EventType.CLICK, this.onButtonClick, this);
  }

  protected onDestroy(): void {
    this.node.off(Button.EventType.CLICK, this.onButtonClick, this);
  }

  /**
   * On button click
   */
  private onButtonClick(): void {
    if (this.scaleOnClick) {
      this.playClickAnimation();
    }

    if (this.enableSound) {
      this.playClickSound();
    }
  }

  /**
   * Play click animation
   */
  private playClickAnimation(): void {
    tween(this.node)
      .to(this.scaleDuration, {
        scale: new Vec3(
          this.originalScale.x * this.clickScale,
          this.originalScale.y * this.clickScale,
          1
        ),
      })
      .to(this.scaleDuration, { scale: this.originalScale })
      .start();
  }

  /**
   * Play click sound
   */
  private playClickSound(): void {
    if (this.audioSource) {
      this.audioSource.play();
    }
  }

  /**
   * Enable/Disable button
   */
  public setEnabled(enabled: boolean): void {
    if (this.button) {
      this.button.interactable = enabled;
    }
  }

  /**
   * Pulse animation (for important buttons)
   */
  public playPulseAnimation(): void {
    const pulseScale = 1.1;

    tween(this.node)
      .to(0.5, { scale: new Vec3(pulseScale, pulseScale, 1) })
      .to(0.5, { scale: this.originalScale })
      .union()
      .repeatForever()
      .start();
  }

  /**
   * Stop all animations
   */
  public stopAnimations(): void {
    tween(this.node).stop();
    this.node.setScale(this.originalScale);
  }
}
