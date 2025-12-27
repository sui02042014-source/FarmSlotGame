import {
  _decorator,
  Component,
  Node,
  EventTouch,
  Vec3,
  Button,
  Sprite,
  SpriteFrame,
  tween,
  Tween,
  UIOpacity,
  math,
} from "cc";
import { GameManager } from "../../core/game-manager/GameManager";
import { GameConfig } from "../../data/config/GameConfig";

const { ccclass, property } = _decorator;

@ccclass("SpinButtonController")
export class SpinButtonController extends Component {
  @property({ tooltip: "Time to hold for Auto Play activation" })
  holdDuration: number = 1.0;

  @property(Sprite)
  targetSprite: Sprite = null!;

  @property(SpriteFrame)
  normalSprite: SpriteFrame = null!;

  @property(SpriteFrame)
  hoverSprite: SpriteFrame = null!;

  @property(SpriteFrame)
  pressedSprite: SpriteFrame = null!;

  @property(SpriteFrame)
  disabledSprite: SpriteFrame = null!;

  @property
  hoverScale: number = 1.05;

  @property
  disabledOpacity: number = 120;

  @property
  enableBreathing: boolean = true;

  private _isHolding: boolean = false;
  private _holdTime: number = 0;
  private _autoPlayActivated: boolean = false;
  private _originalScale: Vec3 = new Vec3(1, 1, 1);
  private _isEnabled: boolean = true;
  private _isHovering: boolean = false;
  private _button: Button | null = null;

  protected onLoad(): void {
    this._originalScale = this.node.scale.clone();
    this._button = this.node.getComponent(Button);

    if (this._button) {
      this._button.transition = Button.Transition.NONE;
      if (!this.targetSprite) {
        this.targetSprite =
          this._button.target?.getComponent(Sprite) ||
          this.node.getComponent(Sprite)!;
      }
    }

    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    this.node.on(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
    this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);

    this.updateVisualState();
    this.playBreathingAnimation();
  }

  protected onDestroy(): void {
    this.node.targetOff(this);
  }

  protected update(dt: number): void {
    if (!this._isHolding || this._autoPlayActivated) return;

    this._holdTime += dt;
    const progress = math.clamp01(this._holdTime / this.holdDuration);
    const scaleEffect = 1 + progress * 0.1;

    this.node.setScale(
      this._originalScale.x * scaleEffect,
      this._originalScale.y * scaleEffect,
      1
    );

    if (this._holdTime >= this.holdDuration) {
      this.onAutoPlayActivated();
    }
  }

  private onTouchStart(event: EventTouch): void {
    const gm = GameManager.getInstance();
    if (
      !this._isEnabled ||
      !gm ||
      gm.getState() !== GameConfig.GAME_STATES.IDLE
    )
      return;

    this._isHolding = true;
    this._isHovering = false;
    this._holdTime = 0;
    this._autoPlayActivated = false;

    Tween.stopAllByTarget(this.node);
    this.updateVisualState();
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this._isHolding) return;

    const activatedAuto = this._autoPlayActivated;
    const timeHeld = this._holdTime;
    const gm = GameManager.getInstance();

    this.resetHoldState();

    // If auto play is active, stop it when button is clicked
    if (gm && gm.isAutoPlayActive() && timeHeld < this.holdDuration && !activatedAuto) {
      gm.toggleAutoPlay();
      return;
    }

    if (timeHeld < this.holdDuration && !activatedAuto) {
      gm?.startSpin();
    }

    this.updateVisualState();
    if (this._isEnabled) this.playBreathingAnimation();
  }

  private onTouchCancel(): void {
    this.resetHoldState();
    this.updateVisualState();
    if (this._isEnabled) this.playBreathingAnimation();
  }

  private onMouseEnter(): void {
    if (!this._isEnabled || this._isHolding) return;

    this._isHovering = true;
    Tween.stopAllByTarget(this.node);
    this.updateVisualState();

    tween(this.node)
      .to(
        0.1,
        {
          scale: new Vec3(
            this._originalScale.x * this.hoverScale,
            this._originalScale.y * this.hoverScale,
            1
          ),
        },
        { easing: "sineOut" }
      )
      .start();
  }

  private onMouseLeave(): void {
    this._isHovering = false;
    if (!this._isEnabled || this._isHolding) return;

    Tween.stopAllByTarget(this.node);
    this.node.setScale(this._originalScale);
    this.updateVisualState();
    this.playBreathingAnimation();
  }

  private updateVisualState(): void {
    if (!this.targetSprite?.isValid) return;

    let frame: SpriteFrame | null = this.normalSprite;

    if (!this._isEnabled) {
      if (this.disabledSprite) {
        frame = this.disabledSprite;
      } else {
        frame = this.normalSprite;
      }
    } else if (this._isHolding) {
      frame = this.pressedSprite || this.normalSprite;
    } else if (this._isHovering) {
      frame = this.hoverSprite || this.normalSprite;
    }

    if (frame) {
      this.targetSprite.spriteFrame = frame;
    }
  }

  private resetHoldState(): void {
    this._isHolding = false;
    this._autoPlayActivated = false;
    this.node.setScale(this._originalScale);
  }

  private onAutoPlayActivated(): void {
    this._autoPlayActivated = true;
    const gm = GameManager.getInstance();
    if (!gm) return;

    if (!gm.isAutoPlayActive()) gm.toggleAutoPlay();
    if (gm.getState() === GameConfig.GAME_STATES.IDLE) gm.startSpin();
  }

  private playBreathingAnimation(): void {
    if (
      !this._isEnabled ||
      this._isHolding ||
      this._isHovering ||
      !this.enableBreathing
    )
      return;

    Tween.stopAllByTarget(this.node);
    const breatheScale = 1.03;

    tween(this.node)
      .to(
        0.8,
        {
          scale: new Vec3(
            this._originalScale.x * breatheScale,
            this._originalScale.y * breatheScale,
            1
          ),
        },
        { easing: "sineInOut" }
      )
      .to(0.8, { scale: this._originalScale }, { easing: "sineInOut" })
      .union()
      .repeatForever()
      .start();
  }

  public setEnabled(enabled: boolean): void {
    this._isEnabled = enabled;

    if (this._button?.isValid) {
      this._button.interactable = enabled;
    }

    const uiOpacity =
      this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
    uiOpacity.opacity = enabled ? 255 : this.disabledOpacity;

    if (!enabled) {
      Tween.stopAllByTarget(this.node);
      this._isHovering = false;
      this._isHolding = false;
      this._holdTime = 0;
      this._autoPlayActivated = false;
      this.node.setScale(this._originalScale);
    } else {
      this.playBreathingAnimation();
    }
    this.updateVisualState();
  }
}
