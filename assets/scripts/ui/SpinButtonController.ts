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
  holdDuration: number = 1.0; // Giữ 1 giây để auto play

  @property
  useStateSprites: boolean = true; // Mỗi trạng thái 1 hình (SpriteFrame)

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
  enableHover: boolean = true; // Hover chỉ hoạt động trên desktop/web

  @property
  hoverScale: number = 1.05;

  @property
  disabledOpacity: number = 120;

  @property
  hideWhenDisabled: boolean = false; // bật nếu muốn giữ behavior cũ (ẩn khi disabled)

  @property
  enableBreathing: boolean = true;

  private isHolding: boolean = false;
  private holdTime: number = 0;
  private originalScale: Vec3 = new Vec3(1, 1, 1);
  private isEnabled: boolean = true;
  private isHovering: boolean = false;
  private button: Button | null = null;

  protected onLoad(): void {
    this.originalScale = this.node.scale.clone();

    this.button = this.node.getComponent(Button);

    // If this node uses the built-in Button transition, it can override spriteFrame changes.
    // When we use custom state sprites, disable Button's transition to avoid conflicts.
    if (
      this.useStateSprites &&
      this.button &&
      (this.button as any)?.transition !== undefined
    ) {
      try {
        (this.button as any).transition = (Button as any).Transition?.NONE ?? 0;
      } catch {
        // ignore
      }
    }

    if (!this.targetSprite) {
      // Common setup: the Sprite is on a child node, so try children as well.
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

    // Register touch events
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);

    if (this.enableHover) {
      this.node.on(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
      this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    }

    // Start breathing animation
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

      // Scale button based on hold time
      const scale = 1 + (this.holdTime / this.holdDuration) * 0.1;
      this.node.setScale(
        this.originalScale.x * scale,
        this.originalScale.y * scale,
        1
      );

      // Check if held long enough for auto play
      if (this.holdTime >= this.holdDuration) {
        this.onAutoPlayActivated();
      }
    }
  }

  /**
   * On touch start
   */
  private onTouchStart(event: EventTouch): void {
    if (!this.isEnabled) return;
    const gameManager = GameManager.getInstance();
    if (!gameManager) return;

    // Check if can spin
    if (gameManager.getState() !== GameConfig.GAME_STATES.IDLE) {
      return;
    }

    this.isHolding = true;
    this.isHovering = false;
    this.holdTime = 0;

    // Stop breathing animation
    Tween.stopAllByTarget(this.node);
    this.updateVisualState();
  }

  /**
   * On touch end (click)
   */
  private onTouchEnd(event: EventTouch): void {
    if (!this.isHolding) return;

    this.isHolding = false;

    // Reset scale
    this.node.setScale(this.originalScale);

    // If held < threshold, it's a normal spin
    if (this.holdTime < this.holdDuration) {
      this.onSpinClick();
    }

    // Resume breathing animation
    this.updateVisualState();
    if (this.isEnabled) this.playBreathingAnimation();
  }

  /**
   * On touch cancel
   */
  private onTouchCancel(event: EventTouch): void {
    this.isHolding = false;
    this.node.setScale(this.originalScale);
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
    if (!this.targetSprite || !this.targetSprite.isValid) {
      // Lazy re-resolve in case Sprite was added later or is on a child.
      this.targetSprite =
        this.node.getComponent(Sprite) ??
        this.node.getComponentInChildren(Sprite) ??
        null!;
    }
    if (!this.targetSprite || !this.targetSprite.isValid) return;

    // Priority: disabled > pressed(holding) > hover > normal
    let frame: SpriteFrame | null = null;
    if (!this.isEnabled) frame = this.disabledSprite;
    else if (this.isHolding) frame = this.pressedSprite;
    else if (this.isHovering) frame = this.hoverSprite;
    else frame = this.normalSprite;

    // Fallbacks
    if (!frame) frame = this.normalSprite;
    if (frame) this.targetSprite.spriteFrame = frame;
  }

  /**
   * On spin click (normal spin)
   */
  private onSpinClick(): void {
    const gameManager = GameManager.getInstance();
    if (gameManager) {
      gameManager.startSpin();
    }
  }

  /**
   * On auto play activated
   */
  private onAutoPlayActivated(): void {
    this.isHolding = false;
    this.node.setScale(this.originalScale);

    const gameManager = GameManager.getInstance();
    if (gameManager) {
      gameManager.toggleAutoPlay();
    }

    console.log("[SpinButton] Auto play activated");
  }

  /**
   * Breathing animation (idle state)
   */
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

  /**
   * Enable/disable button
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;

    // If this node also has a Cocos Button component, keep its interactable in sync.
    // Otherwise the Button's internal state may override spriteFrame changes.
    if (this.button && this.button.isValid) {
      this.button.interactable = enabled;
    }

    if (this.hideWhenDisabled) {
      this.node.active = enabled;
      if (!enabled) return;
    } else {
      this.node.active = true;
    }

    // Visual feedback: mờ khi disabled
    const opacity = enabled ? 255 : this.disabledOpacity;
    const uiOpacity =
      this.node.getComponent(UIOpacity) ?? this.node.addComponent(UIOpacity);
    uiOpacity.opacity = opacity;

    // Khi disabled thì dừng mọi tween và reset scale
    if (!enabled) {
      Tween.stopAllByTarget(this.node);
      this.isHolding = false;
      this.isHovering = false;
      this.node.setScale(this.originalScale);
    } else {
      // Khi enable lại thì chơi lại breathing animation
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
