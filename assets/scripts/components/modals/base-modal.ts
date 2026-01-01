import {
  _decorator,
  Button,
  Component,
  Node,
  tween,
  UIOpacity,
  Vec3,
  BlockInputEvents,
} from "cc";
const { ccclass, property } = _decorator;

// ==========================================
// Constants
// ==========================================

const ANIMATION_CONSTANTS = {
  BACKGROUND_OPACITY_SHOW: 200,
  BACKGROUND_OPACITY_HIDE: 0,
  SCALE_SMALL: 0.5,
  SCALE_NORMAL: 1,
  HIDE_SPEED_MULTIPLIER: 0.5,
} as const;

const CACHED_SCALES = {
  SMALL: new Vec3(
    ANIMATION_CONSTANTS.SCALE_SMALL,
    ANIMATION_CONSTANTS.SCALE_SMALL,
    1
  ),
  NORMAL: new Vec3(
    ANIMATION_CONSTANTS.SCALE_NORMAL,
    ANIMATION_CONSTANTS.SCALE_NORMAL,
    1
  ),
} as const;

@ccclass("BaseModal")
export class BaseModal extends Component {
  @property(Node)
  background: Node = null!;

  @property(Node)
  modalContent: Node = null!;

  @property(Node)
  closeButton: Node = null!;

  @property
  enableBackgroundClose: boolean = true;

  @property
  animationDuration: number = 0.3;

  @property
  enableAnimation: boolean = true;

  @property()
  blockInputUnderneath: boolean = true;

  protected modalData: unknown = null;
  protected closeCallback: (() => void) | null = null;
  private isClosing: boolean = false;

  protected onLoad(): void {
    this.setupBlockInput();
    this.setupCloseButton();
    this.setupBackgroundClick();
    this.node.active = false;
  }

  private setupBlockInput(): void {
    if (this.blockInputUnderneath && !this.getComponent(BlockInputEvents)) {
      this.addComponent(BlockInputEvents);
    }
  }

  private setupCloseButton(): void {
    if (this.closeButton) {
      this.closeButton.on(
        Button.EventType.CLICK,
        this.onCloseButtonClick,
        this
      );
    }
  }

  private setupBackgroundClick(): void {
    if (!this.background || !this.enableBackgroundClose) return;

    let button = this.background.getComponent(Button);
    if (!button) {
      button = this.background.addComponent(Button);
      button.transition = Button.Transition.NONE;
    }
    this.background.on(Button.EventType.CLICK, this.onBackgroundClick, this);
  }

  protected onDestroy(): void {
    if (this.closeButton?.isValid) {
      this.closeButton.off(
        Button.EventType.CLICK,
        this.onCloseButtonClick,
        this
      );
    }

    if (this.background?.isValid) {
      this.background.off(Button.EventType.CLICK, this.onBackgroundClick, this);
    }
  }

  // ==========================================
  // Public API
  // ==========================================

  public setData(data: unknown): void {
    this.modalData = data;
    this.onDataSet(data);
  }

  public show(closeCallback?: () => void): void {
    if (this.isClosing) return;

    this.closeCallback = closeCallback || null;
    this.isClosing = false;
    this.node.active = true;

    this.onBeforeShow();

    const finishShow = () => this.onAfterShow();

    if (this.enableAnimation) {
      this.playShowAnimation(finishShow);
    } else {
      finishShow();
    }
  }

  public hide(): void {
    if (this.isClosing || !this.node.active) return;

    this.isClosing = true;
    this.unscheduleAllCallbacks();
    this.onBeforeHide();

    const finishHide = () => {
      this.node.active = false;
      this.isClosing = false;
      this.onAfterHide();
      this.executeCloseCallback();
    };

    if (this.enableAnimation) {
      this.playHideAnimation(finishHide);
    } else {
      finishHide();
    }
  }

  private executeCloseCallback(): void {
    if (this.closeCallback) {
      this.closeCallback();
      this.closeCallback = null;
    }
  }

  // ==========================================
  // Animation
  // ==========================================

  protected playShowAnimation(callback?: () => void): void {
    this.animateBackgroundOpacity(
      ANIMATION_CONSTANTS.BACKGROUND_OPACITY_HIDE,
      ANIMATION_CONSTANTS.BACKGROUND_OPACITY_SHOW,
      this.animationDuration
    );

    this.animateContentScale(
      CACHED_SCALES.SMALL,
      CACHED_SCALES.NORMAL,
      this.animationDuration,
      "backOut",
      callback
    );
  }

  protected playHideAnimation(callback?: () => void): void {
    const hideDuration =
      this.animationDuration * ANIMATION_CONSTANTS.HIDE_SPEED_MULTIPLIER;

    this.animateBackgroundOpacity(
      ANIMATION_CONSTANTS.BACKGROUND_OPACITY_SHOW,
      ANIMATION_CONSTANTS.BACKGROUND_OPACITY_HIDE,
      hideDuration
    );

    this.animateContentScale(
      CACHED_SCALES.NORMAL,
      CACHED_SCALES.SMALL,
      hideDuration,
      "backIn",
      callback
    );
  }

  private animateBackgroundOpacity(
    from: number,
    to: number,
    duration: number
  ): void {
    if (!this.background) return;

    const opacity =
      this.background.getComponent(UIOpacity) ||
      this.background.addComponent(UIOpacity);

    opacity.opacity = from;
    tween(opacity).to(duration, { opacity: to }).start();
  }

  private animateContentScale(
    fromScale: Vec3,
    toScale: Vec3,
    duration: number,
    easing: "backOut" | "backIn",
    callback?: () => void
  ): void {
    if (!this.modalContent) {
      callback?.();
      return;
    }

    this.modalContent.setScale(fromScale);
    tween(this.modalContent)
      .to(duration, { scale: toScale }, { easing })
      .call(() => callback?.())
      .start();
  }

  // ==========================================
  // Event Handlers
  // ==========================================

  protected onCloseButtonClick(): void {
    this.hide();
  }

  protected onBackgroundClick(): void {
    if (this.enableBackgroundClose) {
      this.hide();
    }
  }

  // ==========================================
  // Lifecycle Hooks (Override in subclasses)
  // ==========================================

  protected onDataSet(data: unknown): void {}
  protected onBeforeShow(): void {}
  protected onAfterShow(): void {}
  protected onBeforeHide(): void {}
  protected onAfterHide(): void {}
}
