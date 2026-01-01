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
import { GameManager } from "../../core/game/game-manager";
import { GameConfig } from "../../data/config/game-config";
import { Logger } from "../../utils/helpers/logger";

const { ccclass, property } = _decorator;

const logger = Logger.create("SpinButtonController");

const SPIN_BUTTON_CONSTANTS = {
  DEFAULT_HOLD_DURATION: 1.0,
  DEFAULT_HOVER_SCALE: 1.05,
  DEFAULT_DISABLED_OPACITY: 120,
  ENABLED_OPACITY: 255,
  HOLD_SCALE_MULTIPLIER: 0.1,
  BREATHE_SCALE: 1.03,
  HOVER_ANIMATION_DURATION: 0.1,
  BREATHE_ANIMATION_DURATION: 0.8,
} as const;

const CACHED_SCALES = {
  ONE: new Vec3(1, 1, 1),
} as const;

@ccclass("SpinButtonController")
export class SpinButtonController extends Component {
  @property({ tooltip: "Time to hold for Auto Play activation" })
  holdDuration: number = SPIN_BUTTON_CONSTANTS.DEFAULT_HOLD_DURATION;

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
  hoverScale: number = SPIN_BUTTON_CONSTANTS.DEFAULT_HOVER_SCALE;

  @property
  disabledOpacity: number = SPIN_BUTTON_CONSTANTS.DEFAULT_DISABLED_OPACITY;

  @property
  enableBreathing: boolean = false;

  private isHolding: boolean = false;
  private holdTime: number = 0;
  private autoPlayActivated: boolean = false;
  private originalScale: Vec3 = CACHED_SCALES.ONE.clone();
  private isEnabled: boolean = true;
  private isHovering: boolean = false;
  private button: Button | null = null;
  private gameManager: GameManager | null = null;
  private tempScale: Vec3 = new Vec3();

  protected onLoad(): void {
    this.cacheManagers();
    this.setupButton();
    this.setupEventListeners();
    this.initializeState();
  }

  private cacheManagers(): void {
    this.gameManager = GameManager.getInstance();
    if (!this.gameManager) {
      logger.error("GameManager not available");
    }
  }

  private setupButton(): void {
    this.originalScale = this.node.scale.clone();
    this.button = this.node.getComponent(Button);

    if (this.button) {
      this.button.transition = Button.Transition.NONE;
      if (!this.targetSprite) {
        this.targetSprite =
          this.button.target?.getComponent(Sprite) ||
          this.node.getComponent(Sprite)!;
      }
    }
  }

  private setupEventListeners(): void {
    this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
    this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
    this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    this.node.on(Node.EventType.MOUSE_ENTER, this.onMouseEnter, this);
    this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
  }

  private initializeState(): void {
    this.updateVisualState();
    this.playBreathingAnimation();
  }

  protected onDestroy(): void {
    this.node.targetOff(this);
  }

  protected update(dt: number): void {
    if (!this.isHolding || this.autoPlayActivated) return;

    this.holdTime += dt;
    this.updateHoldingScale();

    if (this.holdTime >= this.holdDuration) {
      this.onAutoPlayActivated();
    }
  }

  private updateHoldingScale(): void {
    const progress = math.clamp01(this.holdTime / this.holdDuration);
    const scaleEffect =
      1 + progress * SPIN_BUTTON_CONSTANTS.HOLD_SCALE_MULTIPLIER;

    // Reuse tempScale to avoid creating new Vec3 every frame
    this.tempScale.set(
      this.originalScale.x * scaleEffect,
      this.originalScale.y * scaleEffect,
      1
    );
    this.node.setScale(this.tempScale);
  }

  // ==========================================
  // Touch Event Handlers
  // ==========================================

  private onTouchStart(event: EventTouch): void {
    if (!this.canInteract()) return;

    this.isHolding = true;
    this.isHovering = false;
    this.holdTime = 0;
    this.autoPlayActivated = false;

    this.stopAllTweens();
    this.updateVisualState();
  }

  private canInteract(): boolean {
    return (
      this.isEnabled &&
      this.gameManager !== null &&
      this.gameManager.getState() === GameConfig.GAME_STATES.IDLE
    );
  }

  private stopAllTweens(): void {
    Tween.stopAllByTarget(this.node);
  }

  private onTouchEnd(event: EventTouch): void {
    if (!this.isHolding) return;

    const activatedAuto = this.autoPlayActivated;
    const timeHeld = this.holdTime;

    this.resetHoldState();

    if (this.shouldToggleAutoPlay(timeHeld, activatedAuto)) {
      this.gameManager?.toggleAutoPlay();
      return;
    }

    if (this.shouldStartSpin(timeHeld, activatedAuto)) {
      this.gameManager?.startSpin();
    }

    this.updateAfterTouch();
  }

  private shouldToggleAutoPlay(
    timeHeld: number,
    activatedAuto: boolean
  ): boolean {
    return (
      this.gameManager !== null &&
      this.gameManager.isAutoPlayActive() &&
      timeHeld < this.holdDuration &&
      !activatedAuto
    );
  }

  private shouldStartSpin(timeHeld: number, activatedAuto: boolean): boolean {
    return timeHeld < this.holdDuration && !activatedAuto;
  }

  private updateAfterTouch(): void {
    this.updateVisualState();
    if (this.isEnabled) {
      this.playBreathingAnimation();
    }
  }

  private onTouchCancel(): void {
    this.resetHoldState();
    this.updateAfterTouch();
  }

  // ==========================================
  // Mouse Event Handlers
  // ==========================================

  private onMouseEnter(): void {
    if (!this.isEnabled || this.isHolding) return;

    this.isHovering = true;
    this.stopAllTweens();
    this.updateVisualState();
    this.playHoverAnimation();
  }

  private onMouseLeave(): void {
    this.isHovering = false;
    if (!this.isEnabled || this.isHolding) return;

    this.stopAllTweens();
    this.node.setScale(this.originalScale);
    this.updateVisualState();
    this.playBreathingAnimation();
  }

  // ==========================================
  // Visual State Management
  // ==========================================

  private updateVisualState(): void {
    if (!this.targetSprite?.isValid) return;

    const frame = this.getSpriteFrameForCurrentState();
    if (frame) {
      this.targetSprite.spriteFrame = frame;
    }
  }

  private getSpriteFrameForCurrentState(): SpriteFrame | null {
    if (!this.isEnabled) {
      return this.disabledSprite || this.normalSprite;
    }

    if (this.isHolding) {
      return this.pressedSprite || this.normalSprite;
    }

    if (this.isHovering) {
      return this.hoverSprite || this.normalSprite;
    }

    return this.normalSprite;
  }

  private resetHoldState(): void {
    this.isHolding = false;
    this.autoPlayActivated = false;
    this.node.setScale(this.originalScale);
  }

  // ==========================================
  // Auto Play
  // ==========================================

  private onAutoPlayActivated(): void {
    this.autoPlayActivated = true;
    if (!this.gameManager) return;

    if (!this.gameManager.isAutoPlayActive()) {
      this.gameManager.toggleAutoPlay();
    }

    if (this.gameManager.getState() === GameConfig.GAME_STATES.IDLE) {
      this.gameManager.startSpin();
    }
  }

  // ==========================================
  // Animations
  // ==========================================

  private playHoverAnimation(): void {
    this.tempScale.set(
      this.originalScale.x * this.hoverScale,
      this.originalScale.y * this.hoverScale,
      1
    );

    tween(this.node)
      .to(
        SPIN_BUTTON_CONSTANTS.HOVER_ANIMATION_DURATION,
        { scale: this.tempScale },
        { easing: "sineOut" }
      )
      .start();
  }

  private playBreathingAnimation(): void {
    if (!this.shouldPlayBreathingAnimation()) return;

    this.stopAllTweens();

    this.tempScale.set(
      this.originalScale.x * SPIN_BUTTON_CONSTANTS.BREATHE_SCALE,
      this.originalScale.y * SPIN_BUTTON_CONSTANTS.BREATHE_SCALE,
      1
    );

    tween(this.node)
      .to(
        SPIN_BUTTON_CONSTANTS.BREATHE_ANIMATION_DURATION,
        { scale: this.tempScale },
        { easing: "sineInOut" }
      )
      .to(
        SPIN_BUTTON_CONSTANTS.BREATHE_ANIMATION_DURATION,
        { scale: this.originalScale },
        { easing: "sineInOut" }
      )
      .union()
      .repeatForever()
      .start();
  }

  private shouldPlayBreathingAnimation(): boolean {
    return (
      this.isEnabled &&
      !this.isHolding &&
      !this.isHovering &&
      this.enableBreathing
    );
  }

  // ==========================================
  // Public API
  // ==========================================

  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    this.updateButtonInteractivity(enabled);
    this.updateOpacity(enabled);

    if (enabled) {
      this.playBreathingAnimation();
    } else {
      this.resetToDisabledState();
    }

    this.updateVisualState();
  }

  private updateButtonInteractivity(enabled: boolean): void {
    if (this.button?.isValid) {
      this.button.interactable = enabled;
    }
  }

  private updateOpacity(enabled: boolean): void {
    const uiOpacity =
      this.node.getComponent(UIOpacity) || this.node.addComponent(UIOpacity);
    uiOpacity.opacity = enabled
      ? SPIN_BUTTON_CONSTANTS.ENABLED_OPACITY
      : this.disabledOpacity;
  }

  private resetToDisabledState(): void {
    this.stopAllTweens();
    this.isHovering = false;
    this.isHolding = false;
    this.holdTime = 0;
    this.autoPlayActivated = false;
    this.node.setScale(this.originalScale);
  }
}
