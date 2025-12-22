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
} from "cc";
import { GameManager } from "../game/GameManager";
import { GameConfig } from "../data/GameConfig";
import { AudioManager } from "../utils/AudioManager";
const { ccclass, property } = _decorator;

@ccclass("SpinButtonController")
export class SpinButtonController extends Component {
  @property
  holdDuration: number = 1.0;

  @property
  useStateSprites: boolean = true;

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
  enableHover: boolean = true;

  @property
  hoverScale: number = 1.05;

  @property
  disabledOpacity: number = 120;

  @property
  hideWhenDisabled: boolean = false;

  @property
  enableBreathing: boolean = true;

  private isHolding: boolean = false;
  private holdTime: number = 0;
  private autoPlayActivated: boolean = false;
  private originalScale: Vec3 = new Vec3(1, 1, 1);
  private isEnabled: boolean = true;
  private isHovering: boolean = false;
  private button: Button | null = null;

  protected onLoad(): void {
    this.originalScale = this.node.scale.clone();

    this.button = this.node.getComponent(Button);

    if (
      this.useStateSprites &&
      this.button &&
      (this.button as any)?.transition !== undefined
    ) {
      try {
        (this.button as any).transition = (Button as any).Transition?.NONE ?? 0;
      } catch {}
    }

    if (!this.targetSprite) {
      const btnTarget: Node | null = (this.button as any)?.target?.isValid
        ? (this.button as any).target
        : null;

      this.targetSprite =
        btnTarget?.getComponent(Sprite) ??
        btnTarget?.getComponentInChildren(Sprite) ??
        this.node.getComponent(Sprite) ??
        this.node.getComponentInChildren(Sprite) ??
        null!;
    }

    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

    if (this.enableHover) {
      this.node.on(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
      this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    }

    this.updateVisualState();
    this.playBreathingAnimation();
  }

  protected onDestroy(): void {
    this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    this.node.off(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
    this.node.off(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
  }

  protected update(dt: number): void {
    if (this.isHolding) {
      this.holdTime += dt;

      const scale = 1 + (this.holdTime / this.holdDuration) * 0.1;
      this.node.setScale(
        this.originalScale.x * scale,
        this.originalScale.y * scale,
        1
      );

      if (this.holdTime >= this.holdDuration && !this.autoPlayActivated) {
        this.onAutoPlayActivated();
      }
    }
  }

  private onTouchStart(event: EventTouch): void {
    if (!this.isEnabled) return;
    const gameManager = GameManager.getInstance();
    if (!gameManager) return;

    if (gameManager.getState() !== GameConfig.GAME_STATES.IDLE) {
      return;
    }

    this.isHolding = true;
    this.isHovering = false;
    this.holdTime = 0;
    this.autoPlayActivated = false;

    Tween.stopAllByTarget(this.node);
    this.updateVisualState();
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this.isHolding) return;

    const wasAutoPlayActivated = this.autoPlayActivated;
    this.resetHoldState();

    if (this.holdTime < this.holdDuration && !wasAutoPlayActivated) {
      this.onSpinClick();
    }

    this.updateVisualState();
    if (this.isEnabled) this.playBreathingAnimation();
  }

  private onTouchCancel(event: EventTouch): void {
    this.resetHoldState();
    this.updateVisualState();
    if (this.isEnabled) this.playBreathingAnimation();
  }

  private onMouseEnter(): void {
    if (!this.enableHover || !this.isEnabled) return;
    if (this.isHolding) return;

    this.isHovering = true;
    Tween.stopAllByTarget(this.node);
    this.updateVisualState();
    tween(this.node)
      .to(
        0.08,
        {
          scale: new Vec3(
            this.originalScale.x * this.hoverScale,
            this.originalScale.y * this.hoverScale,
            1
          ),
        },
        { easing: "sineOut" }
      )
      .start();
  }

  private onMouseLeave(): void {
    if (!this.enableHover) return;
    this.isHovering = false;
    if (!this.isEnabled || this.isHolding) return;

    Tween.stopAllByTarget(this.node);
    this.node.setScale(this.originalScale);
    this.updateVisualState();
    this.playBreathingAnimation();
  }

  private updateVisualState(): void {
    if (!this.useStateSprites) return;

    if (!this.targetSprite?.isValid) {
      this.targetSprite =
        this.node.getComponent(Sprite) ??
        this.node.getComponentInChildren(Sprite) ??
        null!;
    }
    if (!this.targetSprite?.isValid) return;

    const frame =
      (!this.isEnabled && this.disabledSprite) ||
      (this.isHolding && this.pressedSprite) ||
      (this.isHovering && this.hoverSprite) ||
      this.normalSprite;

    if (frame) this.targetSprite.spriteFrame = frame;
  }

  private resetHoldState(): void {
    this.isHolding = false;
    this.autoPlayActivated = false;
    this.node.setScale(this.originalScale);
  }

  private onSpinClick(): void {
    GameManager.getInstance()?.startSpin();
  }

  private onAutoPlayActivated(): void {
    if (this.autoPlayActivated) return;
    this.autoPlayActivated = true;

    const gameManager = GameManager.getInstance();
    if (!gameManager) return;

    if (!gameManager.isAutoPlayActive()) {
      gameManager.toggleAutoPlay();
    }

    if (gameManager.getState() === GameConfig.GAME_STATES.IDLE) {
      gameManager.startSpin();
    }

    console.log("[SpinButton] Auto play activated");
  }

  private playBreathingAnimation(): void {
    if (!this.isEnabled || this.isHolding || this.isHovering) return;
    if (!this.enableBreathing) return;
    const breatheScale = 1.03;

    Tween.stopAllByTarget(this.node);
    tween(this.node)
      .to(
        0.8,
        {
          scale: new Vec3(
            this.originalScale.x * breatheScale,
            this.originalScale.y * breatheScale,
            1
          ),
        },
        { easing: "sineInOut" }
      )
      .to(0.8, { scale: this.originalScale }, { easing: "sineInOut" })
      .union()
      .repeatForever()
      .start();
  }

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    if (this.button && this.button.isValid) {
      this.button.interactable = enabled;
    }

    if (this.hideWhenDisabled) {
      this.node.active = enabled;
      if (!enabled) return;
    } else {
      this.node.active = true;
    }

    const opacity = enabled ? 255 : this.disabledOpacity;
    const uiOpacity =
      this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    uiOpacity.opacity = opacity;

    if (!enabled) {
      Tween.stopAllByTarget(this.node);
      this.isHovering = false;
      this.resetHoldState();
    } else {
      this.playBreathingAnimation();
    }

    if (this.useStateSprites && !enabled && !this.disabledSprite) {
      console.warn(
        "[SpinButtonController] disabledSprite is not assigned, so disabled state will not show a different image."
      );
    }
    this.updateVisualState();
  }
}
